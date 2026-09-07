import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  signAccessToken,
  generateRefreshToken,
  hashToken,
  ttlToDate,
} from "@/lib/jwt";
import { env } from "@/config/env";
import { ConflictError, UnauthorizedError } from "@/lib/errors";
import { logger } from "@/lib/logger";

function publicUser(user: {
  id: string;
  name: string;
  email: string;
  role: string;
  dateOfBirth: Date | null;
  lifeStage: string | null;
  avatarInitials: string | null;
  onboarded: boolean;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    dateOfBirth: user.dateOfBirth,
    lifeStage: user.lifeStage,
    avatarInitials: user.avatarInitials,
    onboarded: user.onboarded,
  };
}

function initialsFrom(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

async function issueSession(userId: string, role: "WOMAN" | "COACH" | "ADMIN") {
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

export const authService = {
  async register(input: { name: string; email: string; password: string; dateOfBirth?: string }) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new ConflictError("An account with that email already exists.");

    const passwordHash = await hashPassword(input.password);
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        avatarInitials: initialsFrom(input.name),
        dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined,
      },
    });

    const session = await issueSession(user.id, user.role);
    return { user: publicUser(user), ...session };
  },

  async login(email: string, password: string) {
    const user = await prisma.user.findFirst({ where: { email, deletedAt: null } });
    // Deliberately identical error for "no such user" and "wrong password" —
    // never reveal which part of the credential pair was wrong.
    if (!user || !(await verifyPassword(user.passwordHash, password))) {
      throw new UnauthorizedError("That email or password is incorrect.");
    }
    const session = await issueSession(user.id, user.role);
    return { user: publicUser(user), ...session };
  },

  async refresh(refreshToken: string) {
    const tokenHash = hashToken(refreshToken);
    const record = await prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedError("Your session has expired. Please sign in again.");
    }
    const user = await prisma.user.findFirst({ where: { id: record.userId, deletedAt: null } });
    if (!user) throw new UnauthorizedError();

    // Rotate: revoke the used refresh token and issue a new pair, so a
    // stolen-but-already-used refresh token cannot be replayed.
    await prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });
    const session = await issueSession(user.id, user.role);
    return { user: publicUser(user), ...session };
  },

  async logout(refreshToken: string) {
    const tokenHash = hashToken(refreshToken);
    await prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  async completeOnboarding(userId: string) {
    const user = await prisma.user.update({ where: { id: userId }, data: { onboarded: true } });
    return publicUser(user);
  },

  async me(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return publicUser(user);
  },

  async requestPasswordReset(email: string) {
    const user = await prisma.user.findFirst({ where: { email, deletedAt: null } });
    // Always behave the same way whether or not the account exists, so the
    // endpoint can't be used to enumerate registered emails.
    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
      // TODO(email): send `token` via a transactional email provider once
      // one is configured. Never log the raw token.
      logger.info({ userId: user.id }, "Password reset requested");
    }
  },

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = hashToken(token);
    const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedError("That reset link is invalid or has expired.");
    }
    const passwordHash = await hashPassword(newPassword);
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      // Reset invalidates every existing session, not just this device.
      prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  },
};
