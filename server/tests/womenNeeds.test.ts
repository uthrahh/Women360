import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "@/app";
import { prisma } from "@/lib/prisma";

// What the research said tracking apps miss, and one thing Women360 had wrong: stress and energy being filled in for her.

const app = createApp();
const PASSWORD = "a-long-enough-password";
let ip = 30;
const freshIp = () => `198.19.0.${ip++}`;

async function signUp(label: string, options: { demo?: boolean } = {}) {
  const res = await request(app).post("/api/v1/auth/register").set("X-Forwarded-For", freshIp()).send({
    name: "Needs Tester",
    email: `${label}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`,
    password: PASSWORD,
  });
  expect(res.status).toBe(201);
  const id = res.body.data.user.id as string;
  if (options.demo) await prisma.user.update({ where: { id }, data: { isDemo: true } });
  return { id, token: res.body.data.accessToken as string };
}
const as = (token: string) => ({ Authorization: `Bearer ${token}`, "X-Forwarded-For": freshIp() });
const day = (n = 0) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

describe("wellbeing: stress and energy are hers or nothing", () => {
  it("saves a mood on its own without inventing stress or energy", async () => {
    const { id, token } = await signUp("wb-mood-only");
    await request(app).put(`/api/v1/wellbeing/entries/${day(1)}`).set(as(token)).send({ mood: 3, stress: 4, energy: 1 });
    const res = await request(app).put(`/api/v1/wellbeing/entries/${day(0)}`).set(as(token)).send({ mood: 2 });
    expect(res.status).toBeLessThan(300);
    const today = await prisma.wellbeingEntry.findFirst({ where: { userId: id, date: new Date(`${day(0)}T00:00:00.000Z`) } });
    expect(today).toMatchObject({ mood: 2, stress: null, energy: null });
  });

  it("adds stress later without touching the mood, and clears an answer with null", async () => {
    const { id, token } = await signUp("wb-partial");
    await request(app).put(`/api/v1/wellbeing/entries/${day(0)}`).set(as(token)).send({ mood: 3 });
    await request(app).put(`/api/v1/wellbeing/entries/${day(0)}`).set(as(token)).send({ mood: 3, stress: 2, note: "Long day" });
    let row = await prisma.wellbeingEntry.findFirst({ where: { userId: id } });
    expect(row).toMatchObject({ mood: 3, stress: 2, energy: null, note: "Long day" });
    await request(app).put(`/api/v1/wellbeing/entries/${day(0)}`).set(as(token)).send({ mood: 3, stress: null });
    row = await prisma.wellbeingEntry.findFirst({ where: { userId: id } });
    expect(row?.stress).toBeNull();
  });

  it("keeps the insights, report and pattern code working when stress and energy were not given", async () => {
    const { token } = await signUp("wb-nulls");
    for (let i = 0; i < 10; i++) await request(app).put(`/api/v1/wellbeing/entries/${day(i)}`).set(as(token)).send({ mood: i % 5 });
    expect((await request(app).get("/api/v1/insights").set(as(token))).status).toBe(200);
    expect((await request(app).post("/api/v1/reports").set(as(token)).send({ type: "WELLBEING", days: 30 })).status).toBeLessThan(500);
    expect((await request(app).get("/api/v1/insights/low-mood").set(as(token))).status).toBe(200);
  });
});

describe("body log: caffeine, alcohol and bowel movements", () => {
  const log = (token: string, body: object) => request(app).post("/api/v1/body").set(as(token)).send(body);

  it("logs one per tap, lists the day's, and undoes one", async () => {
    const { token } = await signUp("body-basic");
    expect((await log(token, { date: day(0), kind: "caffeine" })).status).toBe(201);
    expect((await log(token, { date: day(0), kind: "caffeine" })).status).toBe(201);
    expect((await log(token, { date: day(0), kind: "alcohol" })).status).toBe(201);
    const bowel = await log(token, { date: day(0), kind: "bowel", detail: "loose" });
    expect(bowel.body.data).toMatchObject({ kind: "bowel", detail: "loose" });
    let list = await request(app).get(`/api/v1/body?date=${day(0)}`).set(as(token));
    expect(list.body.data.map((r: { kind: string }) => r.kind)).toEqual(["caffeine", "caffeine", "alcohol", "bowel"]);
    expect((await request(app).delete(`/api/v1/body/${bowel.body.data.id}`).set(as(token))).status).toBe(204);
    list = await request(app).get(`/api/v1/body?date=${day(0)}`).set(as(token));
    expect(list.body.data).toHaveLength(3);
  });

  it("refuses an unknown kind, a consistency on anything but a bowel movement, and an implausible day", async () => {
    const { token } = await signUp("body-bad");
    expect((await log(token, { date: day(0), kind: "sugar" })).status).toBe(422);
    expect((await log(token, { date: day(0), kind: "caffeine", detail: "loose" })).status).toBe(422);
    expect((await log(token, { date: day(0), kind: "bowel", detail: "bloody" })).status).toBe(422);
    expect((await log(token, { date: "2099-01-01", kind: "caffeine" })).status).toBeGreaterThanOrEqual(400);
  });

  it("keeps each person's entries to themselves", async () => {
    const a = await signUp("body-a");
    const b = await signUp("body-b");
    const mine = await log(a.token, { date: day(0), kind: "alcohol" });
    expect((await request(app).delete(`/api/v1/body/${mine.body.data.id}`).set(as(b.token))).status).toBe(404);
    expect((await request(app).get(`/api/v1/body?date=${day(0)}`).set(as(b.token))).body.data).toEqual([]);
    expect((await request(app).get(`/api/v1/body?date=${day(0)}`).set(as(a.token))).body.data).toHaveLength(1);
  });

  it("is in her data export and goes with her account", async () => {
    const { id, token } = await signUp("body-export");
    await log(token, { date: day(0), kind: "caffeine" });
    const exported = await request(app).get("/api/v1/users/me/export").set(as(token));
    expect(exported.body.data.bodyLogs).toHaveLength(1);
    await prisma.user.delete({ where: { id } });
    expect(await prisma.bodyLog.count({ where: { userId: id } })).toBe(0);
  });

  it("feeds caffeine into the patterns engine when there is enough of it", async () => {
    const { token } = await signUp("body-corr");
    // More coffee, less sleep: a clear pattern over eight days (caffeine can be logged up to 7 days back, like habits).
    for (let i = 0; i <= 7; i++) {
      const cups = (i % 3) + 1;
      for (let c = 0; c < cups; c++) await log(token, { date: day(i), kind: "caffeine" });
      await request(app).put(`/api/v1/sleep/entries/${day(i)}`).set(as(token)).send({ date: day(i), bedDate: day(i + 1), bedtime: "11:00 PM", wakeTime: `${7 - cups}:00 AM`, durationHours: 8 - cups, quality: 3 });
    }
    const insights = await request(app).get("/api/v1/insights").set(as(token));
    const labels = (insights.body.data.correlations.correlations as { labelA: string; labelB: string }[]).flatMap((c) => [c.labelA, c.labelB]);
    expect(labels).toContain("Caffeine drinks");
  });
});

describe("cycle: optional details, recorded only", () => {
  const put = (token: string, date: string, body: object) => request(app).put(`/api/v1/cycle/entries/${date}`).set(as(token)).send({ date, ...body });

  it("records mucus, temperature, sex and products used, and clears them with null", async () => {
    const { id, token } = await signUp("cyc-details");
    const res = await put(token, day(0), { isPeriod: true, flow: "HEAVY", productsUsed: 6, cervicalMucus: "creamy", bbtC: 36.55, intercourse: "protected" });
    expect(res.status).toBeLessThan(300);
    let row = await prisma.cycleEntry.findFirst({ where: { userId: id } });
    expect(row).toMatchObject({ productsUsed: 6, cervicalMucus: "creamy", bbtC: 36.55, intercourse: "protected" });
    await put(token, day(0), { isPeriod: true, cervicalMucus: null, bbtC: null, intercourse: null });
    row = await prisma.cycleEntry.findFirst({ where: { userId: id } });
    expect(row).toMatchObject({ cervicalMucus: null, bbtC: null, intercourse: null, productsUsed: 6 });
  });

  it("refuses values outside the fixed choices and a temperature that can't be a waking temperature", async () => {
    const { token } = await signUp("cyc-bad");
    expect((await put(token, day(0), { cervicalMucus: "green" })).status).toBe(422);
    expect((await put(token, day(0), { bbtC: 41 })).status).toBe(422);
    expect((await put(token, day(0), { bbtC: 30 })).status).toBe(422);
    expect((await put(token, day(0), { intercourse: "yes" })).status).toBe(422);
    expect((await put(token, day(0), { productsUsed: -1 })).status).toBe(422);
  });
});

describe("See it together: her logs side by side", () => {
  it("returns one row per day with gaps as null, never zero", async () => {
    const { token } = await signUp("daily");
    await request(app).post("/api/v1/body").set(as(token)).send({ date: day(2), kind: "caffeine" });
    await request(app).post("/api/v1/body").set(as(token)).send({ date: day(2), kind: "caffeine" });
    await request(app).put(`/api/v1/wellbeing/entries/${day(2)}`).set(as(token)).send({ mood: 4 });
    await request(app).put(`/api/v1/cycle/entries/${day(1)}`).set(as(token)).send({ date: day(1), isPeriod: true, flow: "LIGHT" });
    const res = await request(app).get(`/api/v1/insights/daily?days=30&today=${day(0)}`).set(as(token));
    expect(res.status).toBe(200);
    const rows = res.body.data as { date: string; caffeine: number | null; mood: number | null; stress: number | null; period: boolean }[];
    expect(rows).toHaveLength(30);
    expect(rows[29].date).toBe(day(0));
    expect(rows.find((r) => r.date === day(2))).toMatchObject({ caffeine: 2, mood: 4, stress: null });
    expect(rows.find((r) => r.date === day(1))?.period).toBe(true);
    expect(rows.find((r) => r.date === day(5))).toMatchObject({ caffeine: null, mood: null, period: false });
  });

  it("only offers 30 or 90 days, and only her own", async () => {
    const a = await signUp("daily-a");
    const b = await signUp("daily-b");
    await request(app).post("/api/v1/body").set(as(a.token)).send({ date: day(0), kind: "alcohol" });
    expect((await request(app).get(`/api/v1/insights/daily?days=365&today=${day(0)}`).set(as(a.token))).status).toBe(422);
    const theirs = await request(app).get(`/api/v1/insights/daily?days=30&today=${day(0)}`).set(as(b.token));
    expect(theirs.body.data.every((r: { alcohol: number | null }) => r.alcohol === null)).toBe(true);
  });
});

describe("deleting the cycle and reproductive history on its own", () => {
  it("needs her password", async () => {
    const { token } = await signUp("del-pw");
    const res = await request(app).post("/api/v1/auth/delete-cycle-history").set(as(token)).send({ password: "not the password" });
    expect(res.status).toBe(401);
  });

  it("erases cycle days, settings, reproductive record and declared conditions, and nothing else", async () => {
    const { id, token } = await signUp("del-ok");
    await request(app).put(`/api/v1/cycle/entries/${day(3)}`).set(as(token)).send({ date: day(3), isPeriod: true, flow: "MEDIUM", intercourse: "protected" });
    await request(app).put("/api/v1/cycle/profile").set(as(token)).send({ averageCycleLength: 29, averagePeriodLength: 5 });
    await prisma.reproductiveHealth.create({ data: { userId: id, pregnancyStatus: "NOT_PREGNANT" } }).catch(() => undefined);
    await request(app).put(`/api/v1/wellbeing/entries/${day(0)}`).set(as(token)).send({ mood: 3 });
    await request(app).post("/api/v1/body").set(as(token)).send({ date: day(0), kind: "caffeine" });

    const res = await request(app).post("/api/v1/auth/delete-cycle-history").set(as(token)).send({ password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.data.deletedDays).toBe(1);
    expect(await prisma.cycleEntry.count({ where: { userId: id } })).toBe(0);
    expect(await prisma.cycleProfile.count({ where: { userId: id } })).toBe(0);
    expect(await prisma.reproductiveHealth.count({ where: { userId: id } })).toBe(0);
    // Everything else stays, and so does the account.
    expect(await prisma.wellbeingEntry.count({ where: { userId: id } })).toBe(1);
    expect(await prisma.bodyLog.count({ where: { userId: id } })).toBe(1);
    expect((await request(app).get("/api/v1/auth/me").set(as(token))).status).toBe(200);
  });

  it("is not available on the shared demonstration accounts", async () => {
    const { token } = await signUp("del-demo", { demo: true });
    expect((await request(app).post("/api/v1/auth/delete-cycle-history").set(as(token)).send({ password: PASSWORD })).status).toBe(403);
  });
});
