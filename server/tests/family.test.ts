import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "@/app";
import { prisma } from "@/lib/prisma";

const app = createApp();

async function registerUser(label: string) {
  const email = `${label.toLowerCase().replace(/\s+/g, "-")}.${Date.now()}.${Math.random().toString(36).slice(2)}@example.com`;
  const res = await request(app).post("/api/v1/auth/register").send({ name: label, email, password: "a-long-enough-password" });
  return { token: res.body.data.accessToken as string, id: res.body.data.user.id as string, email };
}
const as = (token: string, actingFor?: string) => ({ Authorization: `Bearer ${token}`, ...(actingFor ? { "X-Acting-For": actingFor } : {}) });
const yearsAgo = (n: number) => `${new Date().getUTCFullYear() - n}-01-15`;
const WATER = { amountMl: 250, date: "2026-11-20" };

describe("family profiles kept by an account", () => {
  let me: Awaited<ReturnType<typeof registerUser>>;
  let stranger: Awaited<ReturnType<typeof registerUser>>;
  let teen = "";

  beforeAll(async () => {
    [me, stranger] = await Promise.all([registerUser("Fam Parent"), registerUser("Fam Stranger")]);
  });

  it("refuses under 13, and under 18 without the guardian confirmation", async () => {
    const tooYoung = await request(app).post("/api/v1/family/profiles").set(as(me.token)).send({ name: "Little", dateOfBirth: yearsAgo(10), cycleTracking: false });
    expect(tooYoung.status).toBe(400);
    const noConsent = await request(app).post("/api/v1/family/profiles").set(as(me.token)).send({ name: "Anu", dateOfBirth: yearsAgo(15), cycleTracking: true });
    expect(noConsent.status).toBe(400);
    const ok = await request(app).post("/api/v1/family/profiles").set(as(me.token)).send({ name: "Anu", dateOfBirth: yearsAgo(15), cycleTracking: true, relation: "Daughter", guardianConfirmed: true });
    expect(ok.status).toBe(201);
    teen = ok.body.data.id;
    const row = await prisma.user.findUniqueOrThrow({ where: { id: teen } });
    expect(row.managedById).toBe(me.id);
    expect(row.guardianConsentAt).not.toBeNull();
    expect(row.email.endsWith(".invalid")).toBe(true);
  });

  it("a profile can't sign in", async () => {
    const row = await prisma.user.findUniqueOrThrow({ where: { id: teen } });
    const res = await request(app).post("/api/v1/auth/login").send({ email: row.email, password: "anything-at-all-123" });
    expect([400, 401]).toContain(res.status);
  });

  it("the manager logs and reads the profile's records, which stay separate from her own", async () => {
    const w = await request(app).post("/api/v1/nutrition/hydration").set(as(me.token, teen)).send(WATER);
    expect(w.status).toBe(201);
    expect(await prisma.hydrationLog.count({ where: { userId: teen } })).toBe(1);
    expect(await prisma.hydrationLog.count({ where: { userId: me.id } })).toBe(0);
    const who = await request(app).get("/api/v1/auth/me").set(as(me.token, teen));
    expect(who.body.data).toMatchObject({ name: "Anu", cycleTracking: true });
    // The change is in the audit log, as a route shape only.
    expect(await prisma.auditLog.count({ where: { actorId: me.id, action: "family.record_changed", targetId: teen } })).toBeGreaterThan(0);
  });

  it("someone else can't open the profile, and the refusal is recorded", async () => {
    const res = await request(app).get("/api/v1/nutrition/today").set(as(stranger.token, teen));
    expect(res.status).toBe(403);
    expect(await prisma.auditLog.count({ where: { actorId: stranger.id, action: "security.family_access_denied" } })).toBe(1);
  });

  it("account, sharing, chat and reproductive routes are closed while acting", async () => {
    for (const [method, path] of [
      ["get", "/api/v1/users/me/export"],
      ["patch", "/api/v1/users/me"],
      ["get", "/api/v1/users/me/reproductive-health"],
      ["get", "/api/v1/coach/sharing"],
      ["get", "/api/v1/family"],
      ["get", "/api/v1/notifications"],
    ] as const) {
      const res = await request(app)[method](path).set(as(me.token, teen)).send({});
      expect(res.status, path).toBe(403);
    }
  });

  it("the manager can download and delete the profile", async () => {
    const exp = await request(app).get(`/api/v1/family/profiles/${teen}/export`).set(as(me.token));
    expect(exp.status).toBe(200);
    expect(exp.body.data.hydrationLogs).toHaveLength(1);
    expect((await request(app).delete(`/api/v1/family/profiles/${teen}`).set(as(stranger.token))).status).toBe(404);
    expect((await request(app).delete(`/api/v1/family/profiles/${teen}`).set(as(me.token))).status).toBe(204);
    expect(await prisma.user.findUnique({ where: { id: teen } })).toBeNull();
  });
});

describe("access between two accounts: monitor and modify", () => {
  let mom: Awaited<ReturnType<typeof registerUser>>;
  let daughter: Awaited<ReturnType<typeof registerUser>>;
  let accessId = "";

  beforeAll(async () => {
    [mom, daughter] = await Promise.all([registerUser("Fam Mom"), registerUser("Fam Daughter")]);
    await request(app).post("/api/v1/nutrition/hydration").set(as(mom.token)).send(WATER);
  });

  it("nothing is visible before she shares", async () => {
    expect((await request(app).get("/api/v1/nutrition/today").set(as(daughter.token, mom.id))).status).toBe(403);
  });

  it("a request waits for the owner, who chooses the level", async () => {
    const r = await request(app).post("/api/v1/family/request").set(as(daughter.token)).send({ email: mom.email });
    expect(r.status).toBe(201);
    accessId = r.body.data.accessId;
    expect((await request(app).get("/api/v1/nutrition/today").set(as(daughter.token, mom.id))).status).toBe(403);
    // Only the owner sets the level.
    expect((await request(app).put(`/api/v1/family/access/${accessId}`).set(as(daughter.token)).send({ level: "MODIFY" })).status).toBe(404);
    const overview = await request(app).get("/api/v1/family").set(as(mom.token));
    expect(overview.body.data.requestsToMe[0].person.name).toBe("Fam Daughter");
    expect((await request(app).put(`/api/v1/family/access/${accessId}`).set(as(mom.token)).send({ level: "MONITOR" })).status).toBe(200);
  });

  it("monitor sees what she logs but can't change anything", async () => {
    const read = await request(app).get("/api/v1/sleep/summary").set(as(daughter.token, mom.id));
    expect(read.status).toBe(200);
    const write = await request(app).post("/api/v1/nutrition/hydration").set(as(daughter.token, mom.id)).send(WATER);
    expect(write.status).toBe(403);
    expect(write.body.error?.message ?? write.body.message).toMatch(/view-only/);
    expect(await prisma.hydrationLog.count({ where: { userId: mom.id } })).toBe(1);
  });

  it("modify lets both of them update her logs", async () => {
    await request(app).put(`/api/v1/family/access/${accessId}`).set(as(mom.token)).send({ level: "MODIFY" });
    const write = await request(app).post("/api/v1/nutrition/hydration").set(as(daughter.token, mom.id)).send(WATER);
    expect(write.status).toBe(201);
    expect(await prisma.hydrationLog.count({ where: { userId: mom.id } })).toBe(2);
    // Access goes one way: the daughter shared nothing back.
    expect((await request(app).get("/api/v1/sleep/summary").set(as(mom.token, daughter.id))).status).toBe(403);
  });

  it("revoking ends it at once", async () => {
    expect((await request(app).delete(`/api/v1/family/access/${accessId}`).set(as(mom.token))).status).toBe(200);
    expect((await request(app).get("/api/v1/sleep/summary").set(as(daughter.token, mom.id))).status).toBe(403);
  });

  it("sharing directly by address, and either side can end it", async () => {
    const s = await request(app).post("/api/v1/family/share").set(as(mom.token)).send({ email: daughter.email, level: "MONITOR" });
    expect(s.status).toBe(201);
    expect((await request(app).get("/api/v1/sleep/summary").set(as(daughter.token, mom.id))).status).toBe(200);
    expect((await request(app).delete(`/api/v1/family/access/${s.body.data.accessId}`).set(as(daughter.token))).status).toBe(200);
    expect((await request(app).get("/api/v1/sleep/summary").set(as(daughter.token, mom.id))).status).toBe(403);
  });

  it("an unknown address says so plainly", async () => {
    const res = await request(app).post("/api/v1/family/share").set(as(mom.token)).send({ email: "nobody.here@example.com", level: "MONITOR" });
    expect(res.status).toBe(400);
  });

  it("she can turn the cycle tracker off for herself", async () => {
    const res = await request(app).patch("/api/v1/users/me").set(as(mom.token)).send({ cycleTracking: false });
    expect(res.body.data.cycleTracking).toBe(false);
  });
});
