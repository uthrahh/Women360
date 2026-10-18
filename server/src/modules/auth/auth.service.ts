import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import { assertPasswordAcceptable } from "@/lib/passwordPolicy";
import {
  signAccessToken,
  generateRefreshToken,
  hashToken,
  ttlToDate,
} from "@/lib/jwt";
import { env } from "@/config/env";
import { BadRequestError, ConflictError, TooManyRequestsError, UnauthorizedError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { publicUser } from "@/lib/publicUser";
import {
  ACCOUNT_FAILURE_LIMIT,
  IP_FAILURE_LIMIT,
  accountKey,
  assertNotLocked,
  clearFailures,
  ipKey,
  recordFailure,
} from "@/lib/security/throttle";
import { recordSecurityEvent } from "@/lib/security/events";

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

// A real argon2 hash to verify against when the email doesn't exist, so
// "no such account" costs the same time as "wrong password" and response
// timing can't be used to find out who is registered.
let dummyHash: Promise<string> | undefined;
function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword(crypto.randomBytes(16).toString("hex"));
  return dummyHash;
}

async function revokeEverySession(userId: string) {
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { sessionsValidAfter: new Date() } }),
    prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
}

export const authService = {
  async register(input: { name: string; email: string; password: string; dateOfBirth?: string; website?: string }, ip?: string) {
    // Honeypot: a field real people never see or fill in. Anything that does
    // is a script. Same generic error as any other failure.
    if (input.website) {
      await recordSecurityEvent({ type: "bot_blocked", ip, detail: { where: "register" } });
      throw new BadRequestError("We couldn't create that account. Please try again.");
    }

    assertPasswordAcceptable(input.password, { email: input.email, name: input.name });

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

  async login(email: string, password: string, ip = "unknown") {
    const keys = [accountKey(email), ipKey(ip)];
    try {
      await assertNotLocked(keys);
    } catch (err) {
      if (err instanceof TooManyRequestsError) await recordSecurityEvent({ type: "login_locked", ip });
      throw err;
    }

    const user = await prisma.user.findFirst({ where: { email, deletedAt: null } });
    const passwordOk = await verifyPassword(user?.passwordHash ?? (await getDummyHash()), password);

    // Deliberately identical error for "no such user" and "wrong password" —
    // never reveal which part of the credential pair was wrong.
    if (!user || !passwordOk) {
      await Promise.all([
        recordFailure(keys[0], ACCOUNT_FAILURE_LIMIT),
        recordFailure(keys[1], IP_FAILURE_LIMIT),
      ]);
      await recordSecurityEvent({ type: "login_failed", userId: user?.id, ip });
      throw new UnauthorizedError("That email or password is incorrect.");
    }

    await clearFailures(keys[0]);
    await recordSecurityEvent({ type: "login_success", userId: user.id, role: user.role, ip });
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

  /** Ends every session on every device, including this one. */
  async logoutEverywhere(userId: string, ip?: string) {
    await revokeEverySession(userId);
    await recordSecurityEvent({ type: "sessions_revoked", userId, ip });
  },

  /**
   * Changes the password, ends every other session immediately, and hands
   * back a fresh session so the device doing the change stays signed in.
   * A wrong current password counts as a failed attempt — a stolen access
   * token alone must not be a way to guess the password.
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string, ip = "unknown") {
    const user = await prisma.user.findFirstOrThrow({ where: { id: userId, deletedAt: null } });
    const keys = [accountKey(user.email), ipKey(ip)];
    await assertNotLocked(keys);

    if (!(await verifyPassword(user.passwordHash, currentPassword))) {
      await Promise.all([recordFailure(keys[0], ACCOUNT_FAILURE_LIMIT), recordFailure(keys[1], IP_FAILURE_LIMIT)]);
      await recordSecurityEvent({ type: "login_failed", userId, ip, detail: { where: "change_password" } });
      throw new UnauthorizedError("Your current password isn't right.");
    }
    if (newPassword === currentPassword) {
      throw new BadRequestError("Choose a password you haven't used for this account before.");
    }
    assertPasswordAcceptable(newPassword, { email: user.email, name: user.name });

    await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(newPassword) } });
    await revokeEverySession(userId);
    await clearFailures(keys[0]);
    await recordSecurityEvent({ type: "password_changed", userId, role: user.role, ip });

    // Issued after sessionsValidAfter was set, so this one is honoured.
    const session = await issueSession(user.id, user.role);
    return { user: publicUser(user), ...session };
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

  async resetPassword(token: string, newPassword: string, ip?: string) {
    const tokenHash = hashToken(token);
    const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash }, include: { user: true } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedError("That reset link is invalid or has expired.");
    }
    assertPasswordAcceptable(newPassword, { email: record.user.email, name: record.user.name });

    const passwordHash = await hashPassword(newPassword);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        // Reset invalidates every existing session, not just this device —
        // refresh tokens below, and already-issued access tokens via this.
        data: { passwordHash, sessionsValidAfter: new Date() },
      }),
      prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    await clearFailures(accountKey(record.user.email));
    await recordSecurityEvent({ type: "password_reset", userId: record.userId, ip });
  },
};

