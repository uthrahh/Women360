import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "@/app";
import { prisma } from "@/lib/prisma";
import { outbox } from "@/lib/mailer";

const app = createApp();

function uniqueEmail(label: string) {
  return `${label}.${Date.now()}.${Math.random().toString(36).slice(2)}@example.com`;
}

async function register(label: string) {
  const email = uniqueEmail(label);
  const res = await request(app).post("/api/v1/auth/register").send({ name: "Asha Verma", email, password: "a-long-enough-password" });
  expect(res.status).toBe(201);
  return { email, token: res.body.data.accessToken as string, id: res.body.data.user.id as string, user: res.body.data.user };
}

/** The confirmation link sent to an address, as the token in it. Sending is not awaited, so wait briefly for it. */
async function linkFor(email: string): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const mail = [...outbox].reverse().find((m) => m.to === email && /Confirm your Women360 email/.test(m.subject));
    if (mail) return decodeURIComponent(/verify-email\?token=([^\s"&]+)/.exec(mail.text)![1]);
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error("no confirmation email");
}

beforeEach(() => {
  outbox.length = 0;
});

describe("confirming an email address", () => {
  it("sends a link at sign-up and starts unconfirmed", async () => {
    const a = await register("verify-signup");
    expect(a.user.emailVerified).toBe(false);
    const token = await linkFor(a.email);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    // Only a hash of the link is stored.
    const rows = await prisma.emailVerificationToken.findMany({ where: { userId: a.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).not.toBe(token);
  });

  it("confirms with the link, once, without needing to be signed in", async () => {
    const a = await register("verify-once");
    const token = await linkFor(a.email);
    const res = await request(app).post("/api/v1/auth/verify-email").send({ token });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ verified: true });
    const me = await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${a.token}`);
    expect(me.body.data.user?.emailVerified ?? me.body.data.emailVerified).toBe(true);
    const again = await request(app).post("/api/v1/auth/verify-email").send({ token });
    expect(again.status).toBe(400);
  });

  it("refuses a wrong or expired link", async () => {
    expect((await request(app).post("/api/v1/auth/verify-email").send({ token: "f".repeat(64) })).status).toBe(400);
    expect((await request(app).post("/api/v1/auth/verify-email").send({})).status).toBe(422);
    const a = await register("verify-expired");
    const token = await linkFor(a.email);
    await prisma.emailVerificationToken.updateMany({ where: { userId: a.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await request(app).post("/api/v1/auth/verify-email").send({ token })).status).toBe(400);
  });

  it("a new link replaces the old one", async () => {
    const a = await register("verify-resend");
    const first = await linkFor(a.email);
    outbox.length = 0;
    const resend = await request(app).post("/api/v1/auth/verify-email/resend").set("Authorization", `Bearer ${a.token}`);
    expect(resend.status).toBe(200);
    expect(resend.body.data.sent).toBe(true);
    const second = await linkFor(a.email);
    expect(second).not.toBe(first);
    expect((await request(app).post("/api/v1/auth/verify-email").send({ token: first })).status).toBe(400);
    expect((await request(app).post("/api/v1/auth/verify-email").send({ token: second })).status).toBe(200);
    // Once confirmed, asking again sends nothing.
    outbox.length = 0;
    const after = await request(app).post("/api/v1/auth/verify-email/resend").set("Authorization", `Bearer ${a.token}`);
    expect(after.body.data).toEqual({ sent: false, alreadyVerified: true });
    expect(outbox).toHaveLength(0);
  });

  it("needs a signed-in, non-demo account to ask for a new link", async () => {
    expect((await request(app).post("/api/v1/auth/verify-email/resend")).status).toBe(401);
    const a = await register("verify-demo");
    await prisma.user.update({ where: { id: a.id }, data: { isDemo: true } });
    expect((await request(app).post("/api/v1/auth/verify-email/resend").set("Authorization", `Bearer ${a.token}`)).status).toBe(403);
  });

  it("never emails the phone's device-only address", async () => {
    const email = `device-${Date.now()}${Math.random().toString(36).slice(2, 8)}@women360.local`;
    const res = await request(app).post("/api/v1/auth/register").send({ name: "Device", email, password: "Zq8#mT2!vRx9-Lp4wK" });
    expect(res.status).toBe(201);
    await new Promise((r) => setTimeout(r, 100));
    expect(outbox.filter((m) => m.to === email)).toHaveLength(0);
  });

  it("goes with the account when it is deleted", async () => {
    const a = await register("verify-cascade");
    await linkFor(a.email);
    await prisma.user.delete({ where: { id: a.id } });
    expect(await prisma.emailVerificationToken.count({ where: { userId: a.id } })).toBe(0);
  });

  it("tells the web app whether it should ask (only when email can be sent)", async () => {
    const res = await request(app).get("/api/v1/config");
    expect(typeof res.body.data.emailVerification).toBe("boolean");
  });
});

describe("retention of spent tokens", () => {
  it("deletes sign-in, reset and confirmation tokens a week after they stop working, and keeps live ones", async () => {
    const { purgeSpentTokens } = await import("@/lib/security/tokens");
    const a = await register("verify-retention");
    await linkFor(a.email);
    const old = new Date(Date.now() - 8 * 86_400_000);
    const live = new Date(Date.now() + 86_400_000);
    await prisma.passwordResetToken.create({ data: { userId: a.id, tokenHash: `spent-${a.id}`, expiresAt: old } });
    await prisma.passwordResetToken.create({ data: { userId: a.id, tokenHash: `live-${a.id}`, expiresAt: live } });
    await prisma.refreshToken.create({ data: { userId: a.id, tokenHash: `revoked-${a.id}`, expiresAt: live, revokedAt: old } });
    await prisma.emailVerificationToken.updateMany({ where: { userId: a.id }, data: { usedAt: old } });
    await purgeSpentTokens();
    expect(await prisma.passwordResetToken.findMany({ where: { userId: a.id }, select: { tokenHash: true } })).toEqual([{ tokenHash: `live-${a.id}` }]);
    expect(await prisma.refreshToken.count({ where: { tokenHash: `revoked-${a.id}` } })).toBe(0);
    expect(await prisma.emailVerificationToken.count({ where: { userId: a.id } })).toBe(0);
    // Her own current session (issued at sign-up) is untouched.
    expect(await prisma.refreshToken.count({ where: { userId: a.id, revokedAt: null } })).toBeGreaterThan(0);
  });
});
