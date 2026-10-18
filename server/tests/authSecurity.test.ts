import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "@/app";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/jwt";
import { accountKey, ipKey } from "@/lib/security/throttle";
import { purgeOldSecurityEvents } from "@/lib/security/events";

const app = createApp();
const PASSWORD = "a-long-enough-password";

// Each test uses its own source IP (trust proxy is on, so this is req.ip) —
// lockout state lives in the database and would otherwise leak between tests.
let ipCounter = 10;
let ip: string;
beforeEach(async () => {
  ip = `198.51.100.${ipCounter++}`;
  // The test database outlives a run, so a lock left behind by the previous
  // run (or this IP's seeded counter) must not leak into this one.
  await prisma.authThrottle.deleteMany({ where: { key: ipKey(ip) } });
});

const api = (method: "post" | "get", path: string) => request(app)[method](`/api/v1${path}`).set("X-Forwarded-For", ip);
const uniqueEmail = (label: string) => `${label}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`;

async function registerUser(label = "sec") {
  const email = uniqueEmail(label);
  const res = await api("post", "/auth/register").send({ name: "Security Tester", email, password: PASSWORD });
  expect(res.status).toBe(201);
  return {
    email,
    id: res.body.data.user.id as string,
    accessToken: res.body.data.accessToken as string,
    refreshToken: res.body.data.refreshToken as string,
  };
}

const login = (email: string, password: string) => api("post", "/auth/login").send({ email, password });

describe("password policy on the API", () => {
  it("rejects a weak password with the specific reason", async () => {
    const res = await api("post", "/auth/register").send({ name: "Weak Pw", email: uniqueEmail("weak"), password: "Password123456" });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("WEAK_PASSWORD");
    expect(res.body.error.message).toMatch(/too easy to guess/);
  });

  it("rejects a password that contains the person's name", async () => {
    const res = await api("post", "/auth/register").send({ name: "Meera Iyer", email: uniqueEmail("name"), password: "meera-loves-tea-99" });
    expect(res.status).toBe(422);
    expect(res.body.error.message).toMatch(/name or email/);
  });

  it("blocks a filled honeypot field and records it as a security event", async () => {
    const res = await api("post", "/auth/register").send({ name: "Bot", email: uniqueEmail("bot"), password: PASSWORD, website: "http://spam.example" });
    expect(res.status).toBe(400);
    const event = await prisma.auditLog.findFirst({ where: { action: "security.bot_blocked" }, orderBy: { createdAt: "desc" } });
    expect(event).not.toBeNull();
  });
});

describe("brute-force lockout (database-backed)", () => {
  it("locks an account after 5 failures — even for the correct password — and unlocks nothing early", async () => {
    const { email } = await registerUser("lock");
    for (let i = 0; i < 5; i++) {
      expect((await login(email, "definitely-wrong-1")).status).toBe(401);
    }
    const locked = await login(email, PASSWORD);
    expect(locked.status).toBe(429);
    expect(locked.body.error.message).toMatch(/Too many attempts/);
  });

  it("gives the same error for a wrong password and an unknown email, and locks both the same way", async () => {
    const { email } = await registerUser("enum");
    const ghost = uniqueEmail("ghost");

    const wrong = await login(email, "definitely-wrong-1");
    const unknown = await login(ghost, "definitely-wrong-1");
    expect(unknown.status).toBe(wrong.status);
    expect(unknown.body.error.message).toBe(wrong.body.error.message);

    // A nonexistent address locks too, so the lock can't be used to find out who's registered.
    for (let i = 0; i < 4; i++) await login(ghost, "definitely-wrong-1");
    expect((await login(ghost, "definitely-wrong-1")).status).toBe(429);
  });

  it("resets the counter on a successful sign-in", async () => {
    const { email } = await registerUser("reset");
    for (let i = 0; i < 4; i++) await login(email, "definitely-wrong-1");
    expect((await login(email, PASSWORD)).status).toBe(200);
    for (let i = 0; i < 4; i++) expect((await login(email, "definitely-wrong-1")).status).toBe(401);
    expect((await login(email, PASSWORD)).status).toBe(200);
  });

  it("locks an IP address after 40 failures across any accounts", async () => {
    const { email } = await registerUser("iplock");
    // Seed the counter one failure short instead of making 40 slow hashed attempts.
    await prisma.authThrottle.create({ data: { key: ipKey(ip), failures: 39 } });
    expect((await login(uniqueEmail("x"), "definitely-wrong-1")).status).toBe(401);
    expect((await login(email, PASSWORD)).status).toBe(429);
  });

  it("stores the counters in the database without the plaintext email", async () => {
    const { email } = await registerUser("stored");
    await login(email, "definitely-wrong-1");
    const row = await prisma.authThrottle.findUnique({ where: { key: accountKey(email) } });
    expect(row?.failures).toBe(1);
    expect(row?.key).not.toContain(email);
  });
});

describe("sessions end immediately", () => {
  it("changing the password kills the old access token and refresh token at once, and keeps this device signed in", async () => {
    const user = await registerUser("chg");
    const before = await api("get", "/auth/me").set("Authorization", `Bearer ${user.accessToken}`);
    expect(before.status).toBe(200);

    const change = await api("post", "/auth/change-password")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ currentPassword: PASSWORD, newPassword: "a-different-long-passphrase" });
    expect(change.status).toBe(200);

    // Same second, same device — still dead, no 15-minute grace.
    expect((await api("get", "/auth/me").set("Authorization", `Bearer ${user.accessToken}`)).status).toBe(401);
    expect((await api("post", "/auth/refresh").send({ refreshToken: user.refreshToken })).status).toBe(401);

    // The session handed back by the change itself works.
    const fresh = await api("get", "/auth/me").set("Authorization", `Bearer ${change.body.data.accessToken}`);
    expect(fresh.status).toBe(200);

    expect((await login(user.email, PASSWORD)).status).toBe(401);
    expect((await login(user.email, "a-different-long-passphrase")).status).toBe(200);
  });

  it("rejects a wrong current password and counts it as a failed attempt", async () => {
    const user = await registerUser("chgwrong");
    const res = await api("post", "/auth/change-password")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ currentPassword: "not-my-password-1", newPassword: "a-different-long-passphrase" });
    expect(res.status).toBe(401);
    const row = await prisma.authThrottle.findUnique({ where: { key: accountKey(user.email) } });
    expect(row?.failures).toBe(1);
  });

  it("rejects a weak or unchanged new password", async () => {
    const user = await registerUser("chgweak");
    const auth = { Authorization: `Bearer ${user.accessToken}` };
    const weak = await api("post", "/auth/change-password").set(auth).send({ currentPassword: PASSWORD, newPassword: "Password123456" });
    expect(weak.status).toBe(422);
    const same = await api("post", "/auth/change-password").set(auth).send({ currentPassword: PASSWORD, newPassword: PASSWORD });
    expect(same.status).toBe(400);
  });

  it("'sign out everywhere' ends every session including the current one", async () => {
    const user = await registerUser("all");
    const second = await login(user.email, PASSWORD);
    expect(second.status).toBe(200);

    const out = await api("post", "/auth/logout-all").set("Authorization", `Bearer ${user.accessToken}`);
    expect(out.status).toBe(200);

    expect((await api("get", "/auth/me").set("Authorization", `Bearer ${user.accessToken}`)).status).toBe(401);
    expect((await api("get", "/auth/me").set("Authorization", `Bearer ${second.body.data.accessToken}`)).status).toBe(401);
    expect((await api("post", "/auth/refresh").send({ refreshToken: second.body.data.refreshToken })).status).toBe(401);
    // Signing in again afterwards works.
    expect((await login(user.email, PASSWORD)).status).toBe(200);
  });

  it("a password reset applies the policy using the account's own name/email and ends live sessions", async () => {
    const user = await registerUser("rst");
    const token = `reset-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 3_600_000) },
    });

    const weak = await api("post", "/auth/password-reset/confirm").send({ token, newPassword: "security-tester-1" });
    expect(weak.status).toBe(422);
    expect(weak.body.error.message).toMatch(/name or email/);

    const ok = await api("post", "/auth/password-reset/confirm").send({ token, newPassword: "a-brand-new-passphrase" });
    expect(ok.status).toBe(200);
    expect((await api("get", "/auth/me").set("Authorization", `Bearer ${user.accessToken}`)).status).toBe(401);
    expect((await login(user.email, "a-brand-new-passphrase")).status).toBe(200);
  });
});

describe("security event log", () => {
  it("records sign-in outcomes with a masked IP and no email or password", async () => {
    const { email, id } = await registerUser("evt");
    await login(email, "definitely-wrong-1");
    await login(email, PASSWORD);

    const events = await prisma.auditLog.findMany({
      where: { actorId: id, action: { startsWith: "security." } },
      orderBy: { createdAt: "asc" },
    });
    expect(events.map((e) => e.action)).toEqual(["security.login_failed", "security.login_success"]);
    for (const e of events) {
      const meta = JSON.stringify(e.metadata);
      expect(meta).toContain(ip.replace(/\.\d+$/, ".x"));
      expect(meta).not.toContain(ip);
      expect(meta).not.toContain(email);
      expect(meta).not.toContain(PASSWORD);
    }
  });

  it("purges security events older than 90 days and leaves everything else", async () => {
    const old = new Date(Date.now() - 100 * 86_400_000);
    const [oldSecurity, oldAdmin, recentSecurity] = await Promise.all([
      prisma.auditLog.create({ data: { action: "security.login_failed", createdAt: old } }),
      prisma.auditLog.create({ data: { action: "user.role_changed", createdAt: old } }),
      prisma.auditLog.create({ data: { action: "security.login_failed" } }),
    ]);
    await purgeOldSecurityEvents();
    expect(await prisma.auditLog.findUnique({ where: { id: oldSecurity.id } })).toBeNull();
    expect(await prisma.auditLog.findUnique({ where: { id: oldAdmin.id } })).not.toBeNull();
    expect(await prisma.auditLog.findUnique({ where: { id: recentSecurity.id } })).not.toBeNull();
  });
});
