import { createHash } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { verifyAccessToken } from "@/lib/jwt";

/**
 * Idempotency keys for POST. A client that sends `Idempotency-Key: <random id>` can safely repeat a request (a retry after a dropped
 * connection, a double tap): the first one runs, and any repeat with the same key gets the first one's answer back and creates nothing.
 *
 *  - Scoped to the signed-in account, so keys can't collide between people or be used to read someone else's answer.
 *  - A repeat with the same key but a different request is refused (422): that is a client bug, not a retry.
 *  - A repeat while the first is still running gets 409 and "try again in a moment".
 *  - Only successful (2xx) answers are remembered. A failed request is forgotten, so correcting and retrying works.
 *  - Remembered for 24 hours, then swept.
 *
 * It runs before the routes, so it reads the bearer token itself (no database lookup); a missing or bad token is simply passed on,
 * and the route's own sign-in check answers it.
 */
const KEY_PATTERN = /^[A-Za-z0-9_-]{8,100}$/;
const MAX_STORED_BYTES = 256 * 1024;
const STALE_PROCESSING_MS = 60_000;
const KEEP_MS = 24 * 3_600_000;
// Not worth guarding, and some must never be replayed from a stored answer.
const SKIP = [/^\/auth\//, /^\/client-errors/, /^\/usage\//, /^\/internal\//];

function pathOf(req: Request): string {
  return req.originalUrl.split("?")[0].replace(/^\/api\/v1/, "");
}

export async function idempotency(req: Request, res: Response, next: NextFunction) {
  const header = req.header("Idempotency-Key");
  if (req.method !== "POST" || !header) return next();
  const path = pathOf(req);
  if (SKIP.some((re) => re.test(path))) return next();

  const auth = req.headers.authorization;
  let userId: string;
  try {
    if (!auth?.startsWith("Bearer ")) return next();
    userId = verifyAccessToken(auth.slice(7)).sub;
  } catch {
    return next();
  }
  if (!KEY_PATTERN.test(header)) {
    return res.status(422).json({ ok: false, error: { code: "VALIDATION_ERROR", message: "The Idempotency-Key header must be 8 to 100 letters, digits, dashes or underscores." } });
  }

  const requestHash = createHash("sha256").update(`${req.method} ${path} ${JSON.stringify(req.body ?? null)}`).digest("hex");
  try {
    let owned = await claim(userId, header, requestHash);
    if (!owned) {
      const existing = await prisma.idempotencyKey.findUnique({ where: { userId_key: { userId, key: header } } });
      if (!existing) owned = await claim(userId, header, requestHash); // it was removed between the two steps
      else if (existing.requestHash !== requestHash) {
        return res.status(422).json({ ok: false, error: { code: "IDEMPOTENCY_KEY_REUSED", message: "That Idempotency-Key was already used for a different request." } });
      } else if (existing.state === "DONE") {
        res.setHeader("Idempotent-Replayed", "true");
        res.status(existing.status ?? 200);
        return existing.response === null || existing.response === undefined ? res.send() : res.json(existing.response);
      } else if (Date.now() - existing.createdAt.getTime() < STALE_PROCESSING_MS) {
        res.setHeader("Retry-After", "1");
        return res.status(409).json({ ok: false, error: { code: "REQUEST_IN_PROGRESS", message: "This request is still being processed. Try again in a moment." } });
      } else {
        // The first attempt never finished (the server restarted): treat it as never having happened.
        await prisma.idempotencyKey.deleteMany({ where: { userId, key: header, state: "PROCESSING" } });
        owned = await claim(userId, header, requestHash);
      }
    }
    if (!owned) return next(); // could not take it (a race): let the request run rather than fail it
  } catch (err) {
    logger.warn({ err }, "Idempotency check failed; running the request normally");
    return next();
  }

  // We own this key: let the request run, and remember its answer if it succeeds. The answer is stored BEFORE it is sent, so a
  // client that has received it and immediately repeats the request always finds it.
  const send = res.send.bind(res);
  let handled = false;
  res.send = ((payload?: unknown) => {
    if (handled) return send(payload as never);
    handled = true;
    let parsed: unknown = null;
    if (typeof payload === "string") {
      try {
        parsed = JSON.parse(payload);
      } catch {
        parsed = null;
      }
    }
    void settle(userId, header, res.statusCode, parsed).finally(() => send(payload as never));
    return res;
  }) as typeof res.send;
  return next();
}

async function claim(userId: string, key: string, requestHash: string): Promise<boolean> {
  const { count } = await prisma.idempotencyKey.createMany({ data: [{ userId, key, requestHash, state: "PROCESSING" }], skipDuplicates: true });
  return count === 1;
}

async function settle(userId: string, key: string, status: number, body: unknown): Promise<void> {
  try {
    const small = body === null || Buffer.byteLength(JSON.stringify(body)) <= MAX_STORED_BYTES;
    if (status >= 200 && status < 300 && small) {
      await prisma.idempotencyKey.updateMany({
        where: { userId, key },
        data: { state: "DONE", status, response: body === null ? Prisma.DbNull : (body as Prisma.InputJsonValue) },
      });
    } else {
      await prisma.idempotencyKey.deleteMany({ where: { userId, key } });
    }
  } catch (err) {
    logger.warn({ err }, "Idempotency result could not be stored");
  }
}

/** Forgets keys older than a day. */
export async function purgeOldIdempotencyKeys(now = new Date()): Promise<number> {
  const { count } = await prisma.idempotencyKey.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - KEEP_MS) } } });
  return count;
}
