import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { env } from "@/config/env";
import { AppError, BadRequestError, ConflictError, UnauthorizedError } from "@/lib/errors";
import { verifyPassword } from "@/lib/password";
import { publicUser } from "@/lib/publicUser";
import { decryptSecret, encryptSecret } from "@/lib/security/crypto";
import { generateSecret, otpauthUri, verifyTotp } from "@/lib/security/totp";
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
import { issueSession, revokeEverySession } from "./session";

const BACKUP_CODE_COUNT = 8;
// No 0/o/1/l/i — codes get read off a screen or paper and typed in by hand.
const BACKUP_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const CHALLENGE_TTL = "5m";

export class TwoFactorUnavailableError extends AppError {
  constructor() {
    super("Two-factor sign-in isn't available right now. Please try again later.", 503, "TWO_FACTOR_UNAVAILABLE");
  }
}

function assertConfigured() {
  if (!env.twoFactorAvailable) throw new TwoFactorUnavailableError();
}

// A different key from the access-token secret, so a login challenge can never
// be replayed as an access token (requireAuth only checks signature + sub).
function challengeSecret(): string {
  return crypto.createHmac("sha256", env.JWT_ACCESS_SECRET).update("two-factor-login-challenge").digest("hex");
}

const normalizeBackupCode = (code: string) => code.toLowerCase().replace(/[^a-z0-9]/g, "");
const hashBackupCode = (code: string) => crypto.createHash("sha256").update(normalizeBackupCode(code)).digest("hex");

function generateBackupCodes(): string[] {
  return Array.from({ length: BACKUP_CODE_COUNT }, () => {
    const chars = Array.from({ length: 10 }, () => BACKUP_ALPHABET[crypto.randomInt(BACKUP_ALPHABET.length)]).join("");
    return `${chars.slice(0, 5)}-${chars.slice(5)}`;
  });
}

async function storeBackupCodes(userId: string): Promise<string[]> {
  const codes = generateBackupCodes();
  await prisma.$transaction([
    prisma.twoFactorBackupCode.deleteMany({ where: { userId } }),
    prisma.twoFactorBackupCode.createMany({ data: codes.map((c) => ({ userId, codeHash: hashBackupCode(c) })) }),
  ]);
  return codes;
}

/** Accepts a 6-digit authenticator code or a backup code. Returns which, or null. Single-use either way. */
async function verifySecondFactor(user: User, input: string): Promise<"totp" | "backup" | null> {
  if (!user.twoFactorSecretEnc) return null;

  if (/^\d[\d\s]*$/.test(input.trim())) {
    const step = verifyTotp(decryptSecret(user.twoFactorSecretEnc), input, user.twoFactorLastStep);
    if (step === null) return null;
    // Compare-and-set: of two simultaneous requests with the same code, only
    // one moves the counter forward and wins.
    const won = await prisma.user.updateMany({
      where: { id: user.id, OR: [{ twoFactorLastStep: null }, { twoFactorLastStep: { lt: step } }] },
      data: { twoFactorLastStep: step },
    });
    return won.count === 1 ? "totp" : null;
  }

  const burned = await prisma.twoFactorBackupCode.updateMany({
    where: { userId: user.id, codeHash: hashBackupCode(input), usedAt: null },
    data: { usedAt: new Date() },
  });
  return burned.count === 1 ? "backup" : null;
}

/** Re-checks the password for a sensitive change; a wrong one counts toward the lockout. */
async function reauthenticate(user: User, password: string, ip: string) {
  const keys = [accountKey(user.email), ipKey(ip)];
  await assertNotLocked(keys);
  if (!(await verifyPassword(user.passwordHash, password))) {
    await Promise.all([recordFailure(keys[0], ACCOUNT_FAILURE_LIMIT), recordFailure(keys[1], IP_FAILURE_LIMIT)]);
    await recordSecurityEvent({ type: "login_failed", userId: user.id, ip, detail: { where: "two_factor_settings" } });
    throw new UnauthorizedError("Your password isn't right.");
  }
}

async function requireSecondFactor(user: User, code: string, ip: string): Promise<"totp" | "backup"> {
  const used = await verifySecondFactor(user, code);
  if (!used) {
    await Promise.all([recordFailure(accountKey(user.email), ACCOUNT_FAILURE_LIMIT), recordFailure(ipKey(ip), IP_FAILURE_LIMIT)]);
    await recordSecurityEvent({ type: "two_factor_failed", userId: user.id, ip });
    throw new UnauthorizedError("That code isn't right, or it's already been used.");
  }
  if (used === "backup") await recordSecurityEvent({ type: "backup_code_used", userId: user.id, ip });
  return used;
}

export const twoFactorService = {
  async status(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const backupCodesRemaining = user.twoFactorEnabled
      ? await prisma.twoFactorBackupCode.count({ where: { userId, usedAt: null } })
      : 0;
    return { available: env.twoFactorAvailable, enabled: user.twoFactorEnabled, backupCodesRemaining };
  },

  /** Starts enrolment: a fresh secret is stored (encrypted) but inactive until a code proves the app has it. */
  async beginSetup(userId: string) {
    assertConfigured();
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.twoFactorEnabled) throw new ConflictError("Two-factor sign-in is already on. Turn it off first to set it up again.");
    const secret = generateSecret();
    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecretEnc: encryptSecret(secret), twoFactorLastStep: null },
    });
    return { secret, otpauthUri: otpauthUri(secret, user.email) };
  },

  async confirmSetup(userId: string, code: string, ip: string) {
    assertConfigured();
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.twoFactorEnabled) throw new ConflictError("Two-factor sign-in is already on.");
    if (!user.twoFactorSecretEnc) throw new BadRequestError("Start setup first.");

    const step = verifyTotp(decryptSecret(user.twoFactorSecretEnc), code, null);
    if (step === null) throw new UnauthorizedError("That code isn't right. Check the time on your phone and try the next one.");

    await prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: true, twoFactorLastStep: step } });
    const backupCodes = await storeBackupCodes(userId);
    await recordSecurityEvent({ type: "two_factor_enabled", userId, role: user.role, ip });
    return { backupCodes };
  },

  /** Needs the password AND a current code, so a stolen session alone can't strip the protection. Ends other sessions. */
  async disable(userId: string, password: string, code: string, ip: string) {
    const user = await prisma.user.findFirstOrThrow({ where: { id: userId, deletedAt: null } });
    if (!user.twoFactorEnabled) throw new BadRequestError("Two-factor sign-in isn't on.");
    await reauthenticate(user, password, ip);
    await requireSecondFactor(user, code, ip);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { twoFactorEnabled: false, twoFactorSecretEnc: null, twoFactorLastStep: null },
      }),
      prisma.twoFactorBackupCode.deleteMany({ where: { userId } }),
    ]);
    await revokeEverySession(userId);
    await recordSecurityEvent({ type: "two_factor_disabled", userId, role: user.role, ip });
    const session = await issueSession(user.id, user.role);
    return { user: publicUser(user), ...session };
  },

  async regenerateBackupCodes(userId: string, password: string, code: string, ip: string) {
    const user = await prisma.user.findFirstOrThrow({ where: { id: userId, deletedAt: null } });
    if (!user.twoFactorEnabled) throw new BadRequestError("Two-factor sign-in isn't on.");
    await reauthenticate(user, password, ip);
    await requireSecondFactor(user, code, ip);
    return { backupCodes: await storeBackupCodes(userId) };
  },

  /** Step one of a 2FA sign-in has passed; hand back a short-lived token that can only be traded for a session with a valid code. */
  createChallenge(userId: string): string {
    return jwt.sign({ sub: userId, purpose: "two-factor-login" }, challengeSecret(), { expiresIn: CHALLENGE_TTL });
  },

  async completeLogin(challengeToken: string, code: string, ip: string) {
    let userId: string;
    try {
      const payload = jwt.verify(challengeToken, challengeSecret()) as { sub: string; purpose?: string };
      if (payload.purpose !== "two-factor-login") throw new Error("wrong purpose");
      userId = payload.sub;
    } catch {
      throw new UnauthorizedError("That sign-in has expired. Please start again.");
    }
    assertConfigured();

    const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user || !user.twoFactorEnabled) throw new UnauthorizedError("That sign-in has expired. Please start again.");

    const keys = [accountKey(user.email), ipKey(ip)];
    await assertNotLocked(keys);
    await requireSecondFactor(user, code, ip);

    // Only now — after BOTH factors — is the failure counter cleared.
    await clearFailures(keys[0]);
    await recordSecurityEvent({ type: "login_success", userId: user.id, role: user.role, ip, detail: { twoFactor: true } });
    const session = await issueSession(user.id, user.role);
    return { user: publicUser(user), ...session };
  },
};
