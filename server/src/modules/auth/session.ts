import { prisma } from "@/lib/prisma";
import { signAccessToken, generateRefreshToken, hashToken, ttlToDate } from "@/lib/jwt";
import { env } from "@/config/env";

export async function issueSession(userId: string, role: "WOMAN" | "COACH" | "ADMIN") {
  const accessToken = signAccessToken({ sub: userId, role });
  const refreshToken = generateRefreshToken();
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(refreshToken),
      expiresAt: ttlToDate(env.JWT_REFRESH_TTL),
    },
  });
  return { accessToken, refreshToken };
}

/** Ends every session on every device: refresh tokens, and already-issued access tokens via sessionsValidAfter. */
export async function revokeEverySession(userId: string) {
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { sessionsValidAfter: new Date() } }),
    prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
}
