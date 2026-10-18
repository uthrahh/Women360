import type { NextFunction, Request, Response } from "express";
import { env } from "@/config/env";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { recordSecurityEvent } from "@/lib/security/events";

const normalizeIp = (ip: string | undefined) => (ip ?? "").replace(/^::ffff:/, "");

/**
 * Optional allow-list (ADMIN_IP_ALLOWLIST). When set, anyone else gets a
 * plain 404 — not 403 — so the admin surface doesn't even confirm it exists.
 * Runs before authentication on purpose.
 */
export async function requireAdminIp(req: Request, _res: Response, next: NextFunction) {
  if (env.adminIpAllowlist.length === 0) return next();
  if (env.adminIpAllowlist.includes(normalizeIp(req.ip))) return next();
  await recordSecurityEvent({ type: "admin_access_denied", ip: req.ip, detail: { reason: "ip_not_allowed" } });
  return next(new NotFoundError());
}

/**
 * Admins must have two-factor sign-in on in production. Deliberately fails
 * closed: if two-factor isn't configured on the server at all, admin tools
 * stay locked rather than quietly running without the protection. Setting
 * it up uses the ordinary /auth/2fa endpoints, which aren't admin-only.
 */
export async function requireAdminTwoFactor(req: Request, _res: Response, next: NextFunction) {
  if (!env.isProduction) return next();
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { twoFactorEnabled: true } });
  if (env.twoFactorAvailable && user?.twoFactorEnabled) return next();
  await recordSecurityEvent({ type: "admin_access_denied", userId: req.user!.id, role: "ADMIN", ip: req.ip, detail: { reason: "two_factor_required" } });
  const err = new ForbiddenError(
    env.twoFactorAvailable
      ? "Turn on two-factor sign-in in Security settings before using admin tools."
      : "Admin tools are locked until two-factor sign-in is configured on the server."
  );
  err.code = "TWO_FACTOR_REQUIRED";
  return next(err);
}
