import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "@/app";
import { env } from "@/config/env";
import { prisma } from "@/lib/prisma";
import { ipKey } from "@/lib/security/throttle";
import { codeForStep, stepFor } from "@/lib/security/totp";

const app = createApp();
const PASSWORD = "a-long-enough-password";

// TOTP codes are bound to 30-second windows and single-use, so these tests
// move the clock (only Date — network/timers stay real) instead of sleeping.
const T0 = Date.UTC(2026, 9, 18, 12, 0, 0);
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
});
afterEach(() => vi.useRealTimers());
const advanceSteps = (n: number) => vi.setSystemTime(Date.now() + n * 30_000);

let ipCounter = 100;
let ip: string;
beforeEach(async () => {
  ip = `203.0.113.${ipCounter++}`;
  await prisma.authThrottle.deleteMany({ where: { key: ipKey(ip) } });
});

const call = (method: "post" | "get", path: string) => request(app)[method](`/api/v1${path}`).set("X-Forwarded-For", ip);
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
const codeNow = (secret: string) => codeForStep(secret, stepFor(Date.now()));

async function newUser() {
  const email = `tfa.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`;
  const res = await call("post", "/auth/register").send({ name: "Factor Tester", email, password: PASSWORD });
  expect(res.status).toBe(201);
  return { email, id: res.body.data.user.id as string, token: res.body.data.accessToken as string };
}

/** Registers a user and turns two-factor on. Leaves the clock one window after the confirming code. */
async function userWithTwoFactor() {
  const user = await newUser();
  const setup = await call("post", "/auth/2fa/setup").set(bearer(user.token));
  expect(setup.status).toBe(200);
  const secret = setup.body.data.secret as string;
  const confirm = await call("post", "/auth/2fa/confirm").set(bearer(user.token)).send({ code: codeNow(secret) });
  expect(confirm.status).toBe(200);
  advanceSteps(1);
  return { ...user, secret, backupCodes: confirm.body.data.backupCodes as string[] };
}

const passwordLogin = (email: string) => call("post", "/auth/login").send({ email, password: PASSWORD });

describe("two-factor enrolment", () => {
  it("reports availability and starts with it off", async () => {
    const user = await newUser();
    const res = await call("get", "/auth/2fa").set(bearer(user.token));
    expect(res.body.data).toEqual({ available: true, enabled: false, backupCodesRemaining: 0 });
  });

  it("stores the secret encrypted, and only activates once a real code is shown", async () => {
    const user = await newUser();
    const setup = await call("post", "/auth/2fa/setup").set(bearer(user.token));
    const { secret, otpauthUri } = setup.body.data;
    expect(otpauthUri).toContain(`secret=${secret}`);

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.twoFactorSecretEnc).toBeTruthy();
    expect(stored.twoFactorSecretEnc).not.toContain(secret);
    expect(stored.twoFactorEnabled).toBe(false);

    const wrong = await call("post", "/auth/2fa/confirm").set(bearer(user.token)).send({ code: "000000" });
    expect(wrong.status).toBe(401);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).twoFactorEnabled).toBe(false);

    const ok = await call("post", "/auth/2fa/confirm").set(bearer(user.token)).send({ code: codeNow(secret) });
    expect(ok.status).toBe(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).twoFactorEnabled).toBe(true);
  });

  it("issues 8 backup codes once, and stores only hashes of them", async () => {
    const user = await userWithTwoFactor();
    expect(user.backupCodes).toHaveLength(8);
    for (const code of user.backupCodes) expect(code).toMatch(/^[a-z2-9]{5}-[a-z2-9]{5}$/);
    expect(new Set(user.backupCodes).size).toBe(8);

    const rows = await prisma.twoFactorBackupCode.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(8);
    for (const row of rows) for (const code of user.backupCodes) expect(row.codeHash).not.toContain(code.replace("-", ""));
    expect((await call("get", "/auth/2fa").set(bearer(user.token))).body.data.backupCodesRemaining).toBe(8);
  });

  it("refuses to start setup again while it's already on", async () => {
    const user = await userWithTwoFactor();
    expect((await call("post", "/auth/2fa/setup").set(bearer(user.token))).status).toBe(409);
  });
});

describe("signing in with two-factor", () => {
  it("asks for a code instead of issuing a session, and the challenge can't be used as an access token", async () => {
    const user = await userWithTwoFactor();
    const step1 = await passwordLogin(user.email);
    expect(step1.status).toBe(200);
    expect(step1.body.data.twoFactorRequired).toBe(true);
    expect(step1.body.data.accessToken).toBeUndefined();
    expect(step1.body.data.refreshToken).toBeUndefined();

    const asAccess = await call("get", "/auth/me").set(bearer(step1.body.data.challengeToken));
    expect(asAccess.status).toBe(401);
  });

  it("completes with a valid authenticator code", async () => {
    const user = await userWithTwoFactor();
    const { challengeToken } = (await passwordLogin(user.email)).body.data;
    const step2 = await call("post", "/auth/login/2fa").send({ challengeToken, code: codeNow(user.secret) });
    expect(step2.status).toBe(200);
    expect((await call("get", "/auth/me").set(bearer(step2.body.data.accessToken))).status).toBe(200);
  });

  it("never accepts the same code twice, even inside its window", async () => {
    const user = await userWithTwoFactor();
    const code = codeNow(user.secret);
    const first = await call("post", "/auth/login/2fa").send({ challengeToken: (await passwordLogin(user.email)).body.data.challengeToken, code });
    expect(first.status).toBe(200);
    const replay = await call("post", "/auth/login/2fa").send({ challengeToken: (await passwordLogin(user.email)).body.data.challengeToken, code });
    expect(replay.status).toBe(401);
  });

  it("rejects a code that's already been used to set up two-factor", async () => {
    const user = await newUser();
    const secret = (await call("post", "/auth/2fa/setup").set(bearer(user.token))).body.data.secret as string;
    const usedCode = codeNow(secret);
    await call("post", "/auth/2fa/confirm").set(bearer(user.token)).send({ code: usedCode });
    const { challengeToken } = (await passwordLogin(user.email)).body.data;
    expect((await call("post", "/auth/login/2fa").send({ challengeToken, code: usedCode })).status).toBe(401);
  });

  it("rejects an expired challenge", async () => {
    const user = await userWithTwoFactor();
    const { challengeToken } = (await passwordLogin(user.email)).body.data;
    advanceSteps(12); // 6 minutes; the challenge lives 5
    const res = await call("post", "/auth/login/2fa").send({ challengeToken, code: codeNow(user.secret) });
    expect(res.status).toBe(401);
  });

  it("rejects an access token presented as a challenge", async () => {
    const user = await userWithTwoFactor();
    const res = await call("post", "/auth/login/2fa").send({ challengeToken: user.token, code: codeNow(user.secret) });
    expect(res.status).toBe(401);
  });

  it("locks the account after repeated wrong codes, even for the right code", async () => {
    const user = await userWithTwoFactor();
    const { challengeToken } = (await passwordLogin(user.email)).body.data;
    for (let i = 0; i < 5; i++) {
      expect((await call("post", "/auth/login/2fa").send({ challengeToken, code: "000000" })).status).toBe(401);
    }
    const locked = await call("post", "/auth/login/2fa").send({ challengeToken, code: codeNow(user.secret) });
    expect(locked.status).toBe(429);
  });

  it("doesn't let a correct password reset the guess budget for the code", async () => {
    const user = await userWithTwoFactor();
    // 4 wrong passwords, then the right one (which must NOT clear them)...
    for (let i = 0; i < 4; i++) {
      expect((await call("post", "/auth/login").send({ email: user.email, password: "definitely-wrong-1" })).status).toBe(401);
    }
    const { challengeToken } = (await passwordLogin(user.email)).body.data;
    // ...so a single wrong code is the 5th failure and locks the account.
    expect((await call("post", "/auth/login/2fa").send({ challengeToken, code: "000000" })).status).toBe(401);
    expect((await call("post", "/auth/login/2fa").send({ challengeToken, code: codeNow(user.secret) })).status).toBe(429);
  });

  it("fails closed if the server loses its key, rather than skipping the second factor", async () => {
    const user = await userWithTwoFactor();
    const original = env.twoFactorAvailable;
    (env as { twoFactorAvailable: boolean }).twoFactorAvailable = false;
    try {
      const res = await passwordLogin(user.email);
      expect(res.status).toBe(503);
      expect(res.body.data?.accessToken).toBeUndefined();
    } finally {
      (env as { twoFactorAvailable: boolean }).twoFactorAvailable = original;
    }
  });
});

describe("backup codes", () => {
  it("work exactly once, in any case/spacing, and are counted and logged", async () => {
    const user = await userWithTwoFactor();
    const backup = user.backupCodes[0];

    const first = await call("post", "/auth/login/2fa").send({
      challengeToken: (await passwordLogin(user.email)).body.data.challengeToken,
      code: backup.toUpperCase().replace("-", " "),
    });
    expect(first.status).toBe(200);

    const again = await call("post", "/auth/login/2fa").send({
      challengeToken: (await passwordLogin(user.email)).body.data.challengeToken,
      code: backup,
    });
    expect(again.status).toBe(401);

    const status = await call("get", "/auth/2fa").set(bearer(first.body.data.accessToken));
    expect(status.body.data.backupCodesRemaining).toBe(7);
    const event = await prisma.auditLog.findFirst({ where: { actorId: user.id, action: "security.backup_code_used" } });
    expect(event).not.toBeNull();
  });

  it("are replaced, not added to, when regenerated", async () => {
    const user = await userWithTwoFactor();
    const regen = await call("post", "/auth/2fa/backup-codes")
      .set(bearer(user.token))
      .send({ password: PASSWORD, code: codeNow(user.secret) });
    expect(regen.status).toBe(200);
    expect(regen.body.data.backupCodes).toHaveLength(8);
    expect(await prisma.twoFactorBackupCode.count({ where: { userId: user.id } })).toBe(8);

    const old = await call("post", "/auth/login/2fa").send({
      challengeToken: (await passwordLogin(user.email)).body.data.challengeToken,
      code: user.backupCodes[0],
    });
    expect(old.status).toBe(401);
  });
});

describe("turning two-factor off", () => {
  it("needs the password and a valid code, then ends other sessions and stops the challenge", async () => {
    const user = await userWithTwoFactor();
    const auth = bearer(user.token);

    expect((await call("post", "/auth/2fa/disable").set(auth).send({ password: "not-my-password-1", code: codeNow(user.secret) })).status).toBe(401);
    expect((await call("post", "/auth/2fa/disable").set(auth).send({ password: PASSWORD, code: "000000" })).status).toBe(401);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).twoFactorEnabled).toBe(true);

    const off = await call("post", "/auth/2fa/disable").set(auth).send({ password: PASSWORD, code: codeNow(user.secret) });
    expect(off.status).toBe(200);

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.twoFactorEnabled).toBe(false);
    expect(stored.twoFactorSecretEnc).toBeNull();
    expect(await prisma.twoFactorBackupCode.count({ where: { userId: user.id } })).toBe(0);

    // The session that made the change is replaced; the old one is dead at once.
    expect((await call("get", "/auth/me").set(auth)).status).toBe(401);
    expect((await call("get", "/auth/me").set(bearer(off.body.data.accessToken))).status).toBe(200);

    const next = await passwordLogin(user.email);
    expect(next.body.data.twoFactorRequired).toBe(false);
    expect(next.body.data.accessToken).toBeTruthy();
  });
});
