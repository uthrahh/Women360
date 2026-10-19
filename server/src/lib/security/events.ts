import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";

/**
 * Security events (sign-ins, failures, lockouts, password changes...) live in
 * the same AuditLog as admin actions, under a "security." prefix. They record
 * that something happened and from roughly where — never a password, a token,
 * a full IP address, or an email.
 */

export const SECURITY_EVENT_RETENTION_DAYS = 90;

/** 203.0.113.42 -> 203.0.113.x ; 2001:db8:85a3:8d3:1319:8a2e:370:7348 -> 2001:db8:85a3:: */
export function maskIp(ip: string | undefined): string {
  if (!ip) return "unknown";
  const v4 = ip.replace(/^::ffff:/, "");
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(v4)) return v4.replace(/\.\d{1,3}$/, ".x");
  if (ip.includes(":")) return `${ip.split(":").slice(0, 3).join(":")}::`;
  return "unknown";
}

export type SecurityEventType =
  | "login_success"
  | "login_failed"
  | "login_locked"
  | "two_factor_failed"
  | "two_factor_enabled"
  | "two_factor_disabled"
  | "backup_code_used"
  | "password_changed"
  | "password_reset"
  | "sessions_revoked"
  | "account_deleted"
  | "bot_blocked"
  | "admin_access_denied";

export async function recordSecurityEvent(input: {
  type: SecurityEventType;
  userId?: string | null;
  role?: Role | null;
  ip?: string;
  detail?: Record<string, string | number | boolean>;
}): Promise<void> {
  try {
    await recordAudit({
      actorId: input.userId ?? null,
      actorRole: input.role ?? null,
      action: `security.${input.type}`,
      metadata: { ip: maskIp(input.ip), ...input.detail },
    });
  } catch (err) {
    // Logging must never be the reason someone can't sign in.
    logger.error({ err, type: input.type }, "Failed to record security event");
  }
}

export async function purgeOldSecurityEvents(): Promise<number> {
  const cutoff = new Date(Date.now() - SECURITY_EVENT_RETENTION_DAYS * 86_400_000);
  const res = await prisma.auditLog.deleteMany({
    where: { action: { startsWith: "security." }, createdAt: { lt: cutoff } },
  });
  return res.count;
}
