import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "@/app";
import { prisma } from "@/lib/prisma";
import { ipKey } from "@/lib/security/throttle";

const app = createApp();
const PASSWORD = "a-long-enough-password";
let ipCounter = 10;
const freshIp = () => `198.51.100.${ipCounter++}`;
const touchedIps: string[] = [];

afterEach(async () => {
  if (touchedIps.length) {
    await prisma.authThrottle.deleteMany({ where: { key: { in: touchedIps.map(ipKey) } } });
    touchedIps.length = 0;
  }
});

async function signUp(label: string) {
  const ip = freshIp();
  touchedIps.push(ip);
  const email = `${label}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`;
  const res = await request(app).post("/api/v1/auth/register").set("X-Forwarded-For", ip).send({ name: "Privacy Tester", email, password: PASSWORD });
  expect(res.status).toBe(201);
  return { id: res.body.data.user.id as string, token: res.body.data.accessToken as string, email, ip };
}
const as = (u: { token: string; ip: string }) => ({ Authorization: `Bearer ${u.token}`, "X-Forwarded-For": u.ip });

describe("data export", () => {
  it("requires sign-in", async () => {
    expect((await request(app).get("/api/v1/users/me/export")).status).toBe(401);
  });

  it("returns the person's own data and never credentials", async () => {
    const me = await signUp("export-me");
    await request(app).post("/api/v1/goals").set(as(me)).send({ title: "Walk daily", category: "ACTIVITY", targetValue: 5, unit: "km" });
    await request(app).post("/api/v1/feedback").set(as(me)).send({ rating: 4, message: "fine" });

    const res = await request(app).get("/api/v1/users/me/export").set(as(me));
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.format).toBe("women360-export-v1");
    expect(data.account.email).toBe(me.email);
    expect(data.goals.map((g: { title: string }) => g.title)).toContain("Walk daily");
    expect(data.feedback).toHaveLength(1);

    const text = JSON.stringify(data);
    expect(text).not.toMatch(/passwordHash|twoFactorSecretEnc|codeHash|tokenHash|\$argon2/i);
  });

  it("never includes another person's data", async () => {
    const a = await signUp("export-a");
    const b = await signUp("export-b");
    await request(app).post("/api/v1/goals").set(as(b)).send({ title: "B's private goal", category: "SLEEP", targetValue: 8, unit: "h" });
    const res = await request(app).get("/api/v1/users/me/export").set(as(a));
    expect(JSON.stringify(res.body.data)).not.toContain("B's private goal");
    expect(JSON.stringify(res.body.data)).not.toContain(b.email);
  });
});

describe("account deletion", () => {
  it("requires sign-in and a password", async () => {
    expect((await request(app).post("/api/v1/auth/delete-account").send({ password: PASSWORD })).status).toBe(401);
    const me = await signUp("del-nopw");
    expect((await request(app).post("/api/v1/auth/delete-account").set(as(me)).send({})).status).toBe(422);
    expect(await prisma.user.count({ where: { id: me.id } })).toBe(1);
  });

  it("rejects a wrong password and leaves the account intact", async () => {
    const me = await signUp("del-wrong");
    const res = await request(app).post("/api/v1/auth/delete-account").set(as(me)).send({ password: "not-the-password-0" });
    expect(res.status).toBe(401);
    expect(await prisma.user.count({ where: { id: me.id } })).toBe(1);
  });

  it("locks out repeated wrong passwords, so a stolen token can't guess", async () => {
    const me = await signUp("del-lock");
    for (let i = 0; i < 5; i++) {
      await request(app).post("/api/v1/auth/delete-account").set(as(me)).send({ password: `wrong-guess-${i}-xx` });
    }
    const res = await request(app).post("/api/v1/auth/delete-account").set(as(me)).send({ password: PASSWORD });
    expect(res.status).toBe(429);
    expect(await prisma.user.count({ where: { id: me.id } })).toBe(1);
    await prisma.authThrottle.deleteMany({});
  });

  it("erases the account and everything it owns, and the old token stops working", async () => {
    const me = await signUp("del-ok");
    const goal = await request(app).post("/api/v1/goals").set(as(me)).send({ title: "Gone soon", category: "ACTIVITY", targetValue: 3, unit: "x" });
    await request(app).post(`/api/v1/goals/${goal.body.data.id}/check-ins`).set(as(me)).send({ date: new Date().toISOString().slice(0, 10) });
    await request(app).post("/api/v1/feedback").set(as(me)).send({ rating: 3 });

    const res = await request(app).post("/api/v1/auth/delete-account").set(as(me)).send({ password: PASSWORD });
    expect(res.status).toBe(204);

    expect(await prisma.user.count({ where: { id: me.id } })).toBe(0);
    expect(await prisma.goal.count({ where: { userId: me.id } })).toBe(0);
    expect(await prisma.goalCheckIn.count({ where: { goalId: goal.body.data.id } })).toBe(0);
    expect(await prisma.feedback.count({ where: { userId: me.id } })).toBe(0);
    expect(await prisma.refreshToken.count({ where: { userId: me.id } })).toBe(0);

    expect((await request(app).get("/api/v1/users/me/export").set(as(me))).status).toBe(401);
    const login = await request(app).post("/api/v1/auth/login").set("X-Forwarded-For", me.ip).send({ email: me.email, password: PASSWORD });
    expect(login.status).toBe(401);
  });

  it("records that a deletion happened without recording who", async () => {
    const me = await signUp("del-audit");
    await request(app).post("/api/v1/auth/delete-account").set(as(me)).send({ password: PASSWORD });
    const events = await prisma.auditLog.findMany({ where: { action: "security.account_deleted" }, orderBy: { createdAt: "desc" }, take: 1 });
    expect(events).toHaveLength(1);
    expect(events[0].actorId).toBeNull();
    expect(JSON.stringify(events[0].metadata)).not.toContain(me.email);
  });

  it("won't delete an administrator through the app", async () => {
    const admin = await signUp("del-admin");
    await prisma.user.update({ where: { id: admin.id }, data: { role: "ADMIN" } });
    const res = await request(app).post("/api/v1/auth/delete-account").set(as(admin)).send({ password: PASSWORD });
    expect([403, 404]).toContain(res.status);
    expect(await prisma.user.count({ where: { id: admin.id } })).toBe(1);
  });
});
