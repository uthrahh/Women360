import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "@/app";
import { prisma } from "@/lib/prisma";
import { SCREENS, countEvent, noteActive, resetUsageCache, rollUp, summary, utcDay } from "@/modules/usage/usage.service";

const app = createApp();
const PASSWORD = "a-long-enough-password";
let ipCounter = 10;
const freshIp = () => `203.0.113.${ipCounter++}`;

async function register(label: string, options: { role?: "COACH" | "ADMIN"; demo?: boolean } = {}) {
  const res = await request(app)
    .post("/api/v1/auth/register")
    .set("X-Forwarded-For", freshIp())
    .send({ name: "Usage Tester", email: `${label}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`, password: PASSWORD });
  expect(res.status).toBe(201);
  const id = res.body.data.user.id as string;
  if (options.role || options.demo) {
    await prisma.user.update({ where: { id }, data: { ...(options.role ? { role: options.role } : {}), ...(options.demo ? { isDemo: true } : {}) } });
  }
  return { id, token: res.body.data.accessToken as string };
}
const as = (token: string) => ({ Authorization: `Bearer ${token}`, "X-Forwarded-For": freshIp() });

async function count(name: string, day = utcDay()): Promise<number> {
  return (await prisma.usageCount.findUnique({ where: { day_name: { day, name } } }))?.count ?? 0;
}
/** Counting happens just after the response is sent, so wait for it rather than assume. */
async function expectCountToRise(name: string, before: number, by = 1) {
  await vi.waitFor(async () => expect(await count(name)).toBe(before + by), { timeout: 3000, interval: 50 });
}
const quiet = () => new Promise((r) => setTimeout(r, 250));

beforeEach(() => resetUsageCache());

describe("usage: screens", () => {
  it("counts a screen a signed-in woman opens", async () => {
    const { token } = await register("usage-view");
    const before = await count("view:sleep");
    const res = await request(app).post("/api/v1/usage/view").set(as(token)).send({ screen: "sleep" });
    expect(res.status).toBe(204);
    await expectCountToRise("view:sleep", before);
  });

  it("needs a sign-in and only accepts screens from the fixed list", async () => {
    const { token } = await register("usage-bad");
    expect((await request(app).post("/api/v1/usage/view").send({ screen: "sleep" })).status).toBe(401);
    expect((await request(app).post("/api/v1/usage/view").set(as(token)).send({ screen: "/app/secret?id=123" })).status).toBe(422);
    expect((await request(app).post("/api/v1/usage/view").set(as(token)).send({})).status).toBe(422);
    expect(SCREENS).toContain("sleep");
  });

  it("does not count staff or the shared demonstration accounts", async () => {
    const coach = await register("usage-coach", { role: "COACH" });
    const demo = await register("usage-demo", { demo: true });
    const before = await count("view:cycle");
    expect((await request(app).post("/api/v1/usage/view").set(as(coach.token)).send({ screen: "cycle" })).status).toBe(204);
    expect((await request(app).post("/api/v1/usage/view").set(as(demo.token)).send({ screen: "cycle" })).status).toBe(204);
    await quiet();
    expect(await count("view:cycle")).toBe(before);
  });
});

describe("usage: actions", () => {
  it("counts an action after it succeeded, and a sign-up", async () => {
    const habitsBefore = await count("habit_created");
    const signupsBefore = await count("signup");
    const { token } = await register("usage-action");
    await expectCountToRise("signup", signupsBefore);
    expect((await request(app).post("/api/v1/habits").set(as(token)).send({ title: "Walk" })).status).toBe(201);
    await expectCountToRise("habit_created", habitsBefore);
  });

  it("does not count a request that failed", async () => {
    const { token } = await register("usage-fail");
    const before = await count("habit_created");
    expect((await request(app).post("/api/v1/habits").set(as(token)).send({ title: "" })).status).toBe(422);
    await quiet();
    expect(await count("habit_created")).toBe(before);
  });

  it("ignores names it doesn't know", async () => {
    await countEvent("made-up-counter");
    expect(await prisma.usageCount.count({ where: { name: "made-up-counter" } })).toBe(0);
  });

  it("never loses a count when many arrive at once", async () => {
    const day = "2020-02-02";
    await prisma.usageCount.deleteMany({ where: { day } });
    await Promise.all(Array.from({ length: 25 }, () => countEvent("view:goals", day)));
    expect(await count("view:goals", day)).toBe(25);
    await prisma.usageCount.deleteMany({ where: { day } });
  });
});

describe("usage: different people, without knowing who", () => {
  it("counts each person once a day and stores nothing that identifies them", async () => {
    const day = "2020-03-03";
    await prisma.usageSeen.deleteMany({ where: { day } });
    await prisma.usageSalt.deleteMany({ where: { day } });
    const a = await register("usage-active-a");
    const b = await register("usage-active-b");
    await noteActive(a.id, day);
    await noteActive(a.id, day);
    await noteActive(b.id, day);
    const rows = await prisma.usageSeen.findMany({ where: { day } });
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.hash).toMatch(/^[0-9a-f]{32}$/);
      expect([a.id, b.id].some((id) => row.hash.includes(id))).toBe(false);
    }
    await prisma.usageSeen.deleteMany({ where: { day } });
    await prisma.usageSalt.deleteMany({ where: { day } });
  });

  it("turns a finished day into one number and deletes the hashes and their salt", async () => {
    // A recent day: counts older than about 13 months are deliberately purged by the same roll-up.
    const day = utcDay(new Date(Date.now() - 3 * 86_400_000));
    await prisma.usageCount.deleteMany({ where: { day } });
    await prisma.usageSeen.deleteMany({ where: { day: { lt: utcDay() } } });
    await prisma.usageSeen.createMany({ data: ["a", "b", "c"].map((hash) => ({ day, hash })) });
    await prisma.usageSalt.create({ data: { day, salt: "temporary" } });
    await rollUp();
    expect(await count("active_users", day)).toBe(3);
    expect(await prisma.usageSeen.count({ where: { day } })).toBe(0);
    expect(await prisma.usageSalt.count({ where: { day } })).toBe(0);
    await rollUp(); // running it again changes nothing
    expect(await count("active_users", day)).toBe(3);
    await prisma.usageCount.deleteMany({ where: { day } });
  });

  it("gives a different hash on a different day, so one day can't be linked to the next", async () => {
    const person = await register("usage-link");
    const d1 = "2020-05-05";
    const d2 = "2020-05-06";
    await prisma.usageSeen.deleteMany({ where: { day: { in: [d1, d2] } } });
    await prisma.usageSalt.deleteMany({ where: { day: { in: [d1, d2] } } });
    await noteActive(person.id, d1);
    await noteActive(person.id, d2);
    const rows = await prisma.usageSeen.findMany({ where: { day: { in: [d1, d2] } } });
    expect(new Set(rows.map((r) => r.hash)).size).toBe(2);
    await prisma.usageSeen.deleteMany({ where: { day: { in: [d1, d2] } } });
    await prisma.usageSalt.deleteMany({ where: { day: { in: [d1, d2] } } });
  });
});

describe("usage: the administrator's summary", () => {
  it("lists every day, the busiest screens and actions, and today's live count", async () => {
    const result = await summary(7);
    expect(result.daily).toHaveLength(7);
    expect(result.daily[6].day).toBe(utcDay());
    expect(result.screens.every((s) => (SCREENS as readonly string[]).includes(s.name))).toBe(true);
    const sorted = [...result.screens].sort((x, y) => y.count - x.count);
    expect(result.screens.map((s) => s.count)).toEqual(sorted.map((s) => s.count));
  });

  it("is for administrators only, and not shown on the demonstration account", async () => {
    const admin = await register("usage-admin", { role: "ADMIN" });
    const demoAdmin = await register("usage-demo-admin", { role: "ADMIN", demo: true });
    const woman = await register("usage-woman");
    const ok = await request(app).get("/api/v1/admin/usage?days=7").set(as(admin.token));
    expect(ok.status).toBe(200);
    expect(ok.body.data.daily).toHaveLength(7);
    expect((await request(app).get("/api/v1/admin/usage").set(as(woman.token))).status).toBe(403);
    expect((await request(app).get("/api/v1/admin/usage")).status).toBe(401);
    expect((await request(app).get("/api/v1/admin/usage").set(as(demoAdmin.token))).status).toBe(403);
    expect((await request(app).get("/api/v1/admin/usage?days=0").set(as(admin.token))).status).toBe(422);
  });
});
