import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { TooManyRequestsError } from "@/lib/errors";

/**
 * Brute-force protection stored in the database, not in memory — the API
 * runs on a free tier that sleeps and restarts, and an in-memory counter
 * quietly resets every time that happens.
 *
 * Two independent counters: per account (a targeted guess at one person's
 * password) and per IP address (one source trying many accounts). Failures
 * are counted for emails that don't exist too, so the lock can't be used to
 * tell whether an address is registered.
 */

export const ACCOUNT_FAILURE_LIMIT = 5;
export const IP_FAILURE_LIMIT = 40;
const WINDOW_MS = 15 * 60_000;
const LOCK_MS = 15 * 60_000;

export const THROTTLE_MESSAGE = "Too many attempts. Please wait about 15 minutes and try again.";

export const accountKey = (email: string) => `acct:${crypto.createHash("sha256").update(email.toLowerCase()).digest("hex")}`;
export const ipKey = (ip: string) => `ip:${ip}`;

/** Throws if any of these keys is currently locked. Never reveals which one. */
export async function assertNotLocked(keys: string[]): Promise<void> {
  const locked = await prisma.authThrottle.findFirst({
    where: { key: { in: keys }, lockedUntil: { gt: new Date() } },
    select: { key: true },
  });
  if (locked) throw new TooManyRequestsError(THROTTLE_MESSAGE);
}

/** Records one failure; locks the key for 15 minutes once it reaches `limit` within the window. */
export async function recordFailure(key: string, limit: number): Promise<void> {
  const now = new Date();
  const existing = await prisma.authThrottle.findUnique({ where: { key } });
  const stale =
    !existing ||
    (existing.lockedUntil !== null && existing.lockedUntil <= now) ||
    now.getTime() - existing.updatedAt.getTime() > WINDOW_MS;
  const failures = stale ? 1 : existing.failures + 1;
  const lockedUntil = failures >= limit ? new Date(now.getTime() + LOCK_MS) : null;
  // updatedAt is set explicitly from the same clock the staleness check reads,
  // rather than left to Prisma's @updatedAt, so the window logic doesn't
  // depend on two clocks agreeing.
  await prisma.authThrottle.upsert({
    where: { key },
    create: { key, failures, lockedUntil, updatedAt: now },
    update: { failures, lockedUntil, updatedAt: now },
  });
}

export async function clearFailures(key: string): Promise<void> {
  await prisma.authThrottle.deleteMany({ where: { key } });
}

/** Drops counters that are neither locked nor recent — the table would otherwise grow with every typo'd email. */
export async function purgeStaleThrottles(): Promise<number> {
  const cutoff = new Date(Date.now() - 24 * 3_600_000);
  const res = await prisma.authThrottle.deleteMany({
    where: { updatedAt: { lt: cutoff }, OR: [{ lockedUntil: null }, { lockedUntil: { lt: new Date() } }] },
  });
  return res.count;
}
