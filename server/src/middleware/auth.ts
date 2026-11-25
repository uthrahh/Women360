import type { NextFunction, Request, Response } from "express";
import type { Role } from "@prisma/client";
import { verifyAccessToken } from "@/lib/jwt";
import { UnauthorizedError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { resolveActing } from "@/modules/family/acting";

export interface AuthenticatedUser {
  /** Whose records this request reads and writes: her own, or a family member's she was given access to. */
  id: string;
  role: Role;
  isDemo: boolean;
  /** Set only while she is looking at a family member's records: her own id, and the access she has. */
  actorId?: string;
  access?: "MANAGE" | "MODIFY" | "MONITOR";
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Verifies the bearer access token and attaches { id, role } to req.user.
 * Confirms the account still exists and isn't soft-deleted on every
 * request — a short-lived access token (15 min default) makes this cheap
 * enough to do unconditionally rather than trusting stale token claims.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new UnauthorizedError());
  }

  try {
    const payload = verifyAccessToken(header.slice("Bearer ".length));
    const user = await prisma.user.findFirst({
      where: { id: payload.sub, deletedAt: null },
      select: { id: true, role: true, isDemo: true, sessionsValidAfter: true },
    });
    if (!user) return next(new UnauthorizedError());
    // A password change or "sign out everywhere" sets sessionsValidAfter;
    // tokens issued before it are dead immediately, not 15 minutes later.
    // Millisecond claim where present; older tokens fall back to iat.
    const issuedAtMs = payload.iatMs ?? (payload.iat ?? 0) * 1000;
    if (user.sessionsValidAfter && issuedAtMs < user.sessionsValidAfter.getTime()) {
      return next(new UnauthorizedError("Your session has ended. Please sign in again."));
    }
    req.user = { id: user.id, role: user.role, isDemo: user.isDemo };
  } catch {
    return next(new UnauthorizedError("Your session has expired. Please sign in again."));
  }
  // "X-Acting-For": a family member's records instead of her own. Checked on every request, never remembered.
  const actingFor = req.headers["x-acting-for"];
  if (typeof actingFor === "string" && actingFor && actingFor !== req.user.id) {
    try {
      req.user = await resolveActing(req.user, actingFor, req.method, req.originalUrl);
    } catch (err) {
      return next(err);
    }
  }
  return next();
}
