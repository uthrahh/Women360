import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "@/app";
import { prisma } from "@/lib/prisma";

const app = createApp();
const PASSWORD = "a-long-enough-password";
let ipCounter = 10;
const freshIp = () => `198.51.100.${ipCounter++}`;

async function register(label: string, options: { role?: "COACH" | "ADMIN"; demo?: boolean } = {}) {
  const email = `${label}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`;
  const res = await request(app).post("/api/v1/auth/register").set("X-Forwarded-For", freshIp()).send({ name: "Role Tester", email, password: PASSWORD });
  expect(res.status).toBe(201);
  const id = res.body.data.user.id as string;
  if (options.role || options.demo) {
    await prisma.user.update({ where: { id }, data: { ...(options.role ? { role: options.role } : {}), ...(options.demo ? { isDemo: true } : {}) } });
  }
  return { id, email, token: res.body.data.accessToken as string };
}
const as = (token: string) => ({ Authorization: `Bearer ${token}`, "X-Forwarded-For": freshIp() });

describe("administrator overview", () => {
  it("counts accounts by role, for admins only", async () => {
    const admin = await register("ov-admin", { role: "ADMIN" });
    const woman = await register("ov-woman");
    const res = await request(app).get("/api/v1/admin/overview").set(as(admin.token));
    expect(res.status).toBe(200);
    expect(res.body.data.users.total).toBeGreaterThanOrEqual(2);
    expect(res.body.data.users.women).toBeGreaterThanOrEqual(1);
    expect(res.body.data.scopedToDemo).toBe(false);
    expect((await request(app).get("/api/v1/admin/overview").set(as(woman.token))).status).toBe(403);
    expect((await request(app).get("/api/v1/admin/overview")).status).toBe(401);
  });
});

describe("the shared demo administrator", () => {
  it("sees only demo accounts, never real people", async () => {
    const real = await register("demo-real-person");
    const demoWoman = await register("demo-a-woman", { demo: true });
    const demoAdmin = await register("demo-admin", { role: "ADMIN", demo: true });

    const users = await request(app).get("/api/v1/admin/users?pageSize=100").set(as(demoAdmin.token));
    expect(users.status).toBe(200);
    const emails = users.body.data.map((u: { email: string }) => u.email);
    expect(emails).toContain(demoWoman.email);
    expect(emails).not.toContain(real.email);

    const overview = await request(app).get("/api/v1/admin/overview").set(as(demoAdmin.token));
    expect(overview.body.data.scopedToDemo).toBe(true);
  });

  it("is read-only: cannot change a role, deactivate anyone or edit shared content", async () => {
    const real = await register("demo-ro-real");
    const demoAdmin = await register("demo-ro-admin", { role: "ADMIN", demo: true });

    const role = await request(app).patch(`/api/v1/admin/users/${real.id}/role`).set(as(demoAdmin.token)).send({ role: "COACH" });
    expect(role.status).toBe(403);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: real.id } })).role).toBe("WOMAN");

    expect((await request(app).delete(`/api/v1/admin/users/${real.id}`).set(as(demoAdmin.token))).status).toBe(403);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: real.id } })).deletedAt).toBeNull();

    const article = await request(app)
      .post("/api/v1/learn")
      .set(as(demoAdmin.token))
      .send({ title: "Vandalism", category: "x", readMins: 1, dek: "x", publish: true });
    expect(article.status).toBe(403);
    expect((await request(app).get("/api/v1/learn").set(as(demoAdmin.token))).status).toBe(200);
  });

  it("does not need two-factor, because it can only read demo data", async () => {
    const demoAdmin = await register("demo-2fa-admin", { role: "ADMIN", demo: true });
    expect((await request(app).get("/api/v1/admin/audit-log").set(as(demoAdmin.token))).status).toBe(200);
    expect((await request(app).get("/api/v1/admin/feedback").set(as(demoAdmin.token))).status).toBe(200);
  });
});

describe("shared demo accounts cannot lock others out", () => {
  it("refuses password change, deleting the account, two-factor and signing out everywhere", async () => {
    const demo = await register("demo-locked", { demo: true });
    const change = await request(app)
      .post("/api/v1/auth/change-password")
      .set(as(demo.token))
      .send({ currentPassword: PASSWORD, newPassword: "Quartz-Lantern-Meadow-718" });
    expect(change.status).toBe(403);
    expect((await request(app).post("/api/v1/auth/delete-account").set(as(demo.token)).send({ password: PASSWORD })).status).toBe(403);
    expect((await request(app).post("/api/v1/auth/2fa/setup").set(as(demo.token))).status).toBe(403);
    expect((await request(app).post("/api/v1/auth/logout-all").set(as(demo.token))).status).toBe(403);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: demo.id } })).deletedAt).toBeNull();
  });

  it("still lets an ordinary account do all of those", async () => {
    const real = await register("demo-not-locked");
    const change = await request(app)
      .post("/api/v1/auth/change-password")
      .set(as(real.token))
      .send({ currentPassword: PASSWORD, newPassword: "Quartz-Lantern-Meadow-718" });
    expect(change.status).toBe(200);
  });

  it("reports whether the signed-in account is a demo account", async () => {
    const demo = await register("demo-flag", { demo: true });
    const real = await register("demo-flag-real");
    expect((await request(app).get("/api/v1/auth/me").set(as(demo.token))).body.data.isDemo).toBe(true);
    expect((await request(app).get("/api/v1/auth/me").set(as(real.token))).body.data.isDemo).toBe(false);
  });
});

describe("coach access from the woman's side", () => {
  it("a woman can share with a coach by email, see who has access, and revoke it", async () => {
    const woman = await register("sh-woman");
    const coach = await register("sh-coach", { role: "COACH" });

    const grant = await request(app).post("/api/v1/coach/sharing").set(as(woman.token)).send({ coachEmail: coach.email });
    expect(grant.status).toBe(201);
    const list = await request(app).get("/api/v1/coach/sharing").set(as(woman.token));
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].coach.email).toBe(coach.email);

    expect((await request(app).get(`/api/v1/coach/women/${woman.id}/summary`).set(as(coach.token))).status).toBe(200);

    const revoke = await request(app).delete("/api/v1/coach/sharing").set(as(woman.token)).send({ coachId: coach.id });
    expect(revoke.status).toBe(200);
    expect((await request(app).get(`/api/v1/coach/women/${woman.id}/summary`).set(as(coach.token))).status).toBe(403);
  });

  it("a coach only sees women who shared with them", async () => {
    const shared = await register("sh2-shared");
    const other = await register("sh2-other");
    const coach = await register("sh2-coach", { role: "COACH" });
    await request(app).post("/api/v1/coach/sharing").set(as(shared.token)).send({ coachEmail: coach.email });
    const list = await request(app).get("/api/v1/coach/assigned-women").set(as(coach.token));
    const ids = list.body.data.map((w: { id: string }) => w.id);
    expect(ids).toContain(shared.id);
    expect(ids).not.toContain(other.id);
  });

  it("a woman sees only the notes her coach made visible to her", async () => {
    const woman = await register("sh3-woman");
    const coach = await register("sh3-coach", { role: "COACH" });
    await request(app).post("/api/v1/coach/sharing").set(as(woman.token)).send({ coachEmail: coach.email });
    await request(app).post(`/api/v1/coach/women/${woman.id}/notes`).set(as(coach.token)).send({ note: "Visible note", visibleToWoman: true });
    await request(app).post(`/api/v1/coach/women/${woman.id}/notes`).set(as(coach.token)).send({ note: "Private note", visibleToWoman: false });
    const notes = await request(app).get("/api/v1/coach/sharing/notes").set(as(woman.token));
    const texts = notes.body.data.map((n: { note: string }) => n.note);
    expect(texts).toEqual(["Visible note"]);
  });
});

describe("reproductive health records", () => {
  const put = (token: string, body: object) => request(app).put("/api/v1/users/me/reproductive-health").set(as(token)).send(body);
  const get = (token: string) => request(app).get("/api/v1/users/me/reproductive-health").set(as(token));

  it("is empty until she records something", async () => {
    const t = await register("rh-empty");
    const res = await get(t.token);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });

  it("saves contraception and pregnancy status, keeping a due date only while pregnant", async () => {
    const t = await register("rh-save");
    const pregnant = await put(t.token, { pregnancyStatus: "PREGNANT", expectedDueDate: "2027-03-01", contraception: "NONE" });
    expect(pregnant.status).toBe(200);
    expect(pregnant.body.data).toMatchObject({ pregnancyStatus: "PREGNANT", contraception: "NONE" });
    expect(pregnant.body.data.expectedDueDate).toContain("2027-03-01");

    const postpartum = await put(t.token, { pregnancyStatus: "POSTPARTUM" });
    expect(postpartum.body.data.expectedDueDate).toBeNull();
    expect(postpartum.body.data.contraception).toBe("NONE");
  });

  it("changes only what is sent and lets her clear a field", async () => {
    const t = await register("rh-partial");
    await put(t.token, { contraception: "PILL", pregnancyStatus: "NOT_PREGNANT", notes: "Started last year" });
    const res = await put(t.token, { notes: null });
    expect(res.body.data).toMatchObject({ contraception: "PILL", pregnancyStatus: "NOT_PREGNANT", notes: null });
  });

  it("rejects values outside the list and requires sign-in", async () => {
    const t = await register("rh-bad");
    expect((await put(t.token, { contraception: "MAGIC" })).status).toBe(422);
    expect((await put(t.token, { expectedDueDate: "soon" })).status).toBe(422);
    expect((await request(app).get("/api/v1/users/me/reproductive-health")).status).toBe(401);
  });

  it("keeps each person's records private and includes them in her data export", async () => {
    const a = await register("rh-a");
    const b = await register("rh-b");
    await put(a.token, { contraception: "IMPLANT" });
    expect((await get(b.token)).body.data).toBeNull();
    const exported = await request(app).get("/api/v1/users/me/export").set(as(a.token));
    expect(exported.body.data.reproductiveHealth).toMatchObject({ contraception: "IMPLANT" });
  });
});
