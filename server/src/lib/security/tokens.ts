import { prisma } from "@/lib/prisma";

/** How long a finished sign-in, reset or confirmation token is kept before it is deleted (only its hash was ever stored). */
export const SPENT_TOKEN_RETENTION_DAYS = 7;

/**
 * Retention for one-time and session tokens: once a token has expired, been used or been revoked it can never work
 * again, so after a short grace period (kept for troubleshooting a failed sign-in) it is deleted. Part of the daily sweep.
 */
export async function purgeSpentTokens(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - SPENT_TOKEN_RETENTION_DAYS * 86_400_000);
  const spent = { OR: [{ expiresAt: { lt: cutoff } }, { usedAt: { lt: cutoff } }] };
  const [refresh, reset, verify, invite] = await prisma.$transaction([
    prisma.refreshToken.deleteMany({ where: { OR: [{ expiresAt: { lt: cutoff } }, { revokedAt: { lt: cutoff } }] } }),
    prisma.passwordResetToken.deleteMany({ where: spent }),
    prisma.emailVerificationToken.deleteMany({ where: spent }),
    prisma.accountInvite.deleteMany({ where: spent }),
  ]);
  return refresh.count + reset.count + verify.count + invite.count;
}
