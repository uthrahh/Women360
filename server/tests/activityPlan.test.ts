import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "@/app";
import { prisma } from "@/lib/prisma";
import { addDays } from "@/modules/activity/plan/planner";
import { baselineFrom, defaultsFrom } from "@/modules/activity/plan/baseline";

const app = createApp();
const PASSWORD = "a-long-enough-password";
const today = () => new Date().toISOString().slice(0, 10);

let ip = 120;
async function signUp(label: string, extra: object = {}) {
  const res = await request(app).post("/api/v1/auth/register").set("X-Forwarded-For", `198.51.100.${ip++}`).send({
    name: "Plan Tester",
    email: `${label}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`,
    password: PASSWORD,
    ...extra,
  });
  expect(res.status).toBe(201);
  return { token: res.body.data.accessToken as string, id: res.body.data.user.id as string };
}
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const body = (over: object = {}) => ({ goal: "HEALTH", weeks: 8, days: [1, 2, 4, 5, 6], sessionMinutes: 45, startDate: today(), activityCodes: [], ...over });
const preview = (t: string, over: object = {}) => request(app).post("/api/v1/activity/plan/preview").set(auth(t)).send(body(over));
const start = (t: string, over: object = {}) => request(app).post("/api/v1/activity/plan").set(auth(t)).send(body(over));
const active = (t: string) => request(app).get(`/api/v1/activity/plan/active?today=${today()}`).set(auth(t));
const log = (t: string, over: object = {}) =>
  request(app).post("/api/v1/activity/entries").set(auth(t)).send({ date: today(), activityCode: "walking", durationMinutes: 30, intensity: "MODERATE", ...over });

describe("activity plan: from her logged activity", () => {
  it("works out where she is now, ignoring light effort, chores and old free-text entries", () => {
    const at = (code: string, minutes: number, intensity: "LOW" | "MODERATE" | "HIGH", iso = "2026-11-02") => ({ activityCode: code, durationMinutes: minutes, intensity, date: new Date(`${iso}T00:00:00.000Z`) });
    const baseline = baselineFrom([
      at("walking", 120, "MODERATE"), // 120 moderate
      at("walking", 60, "LOW"), // light: doesn't count
      at("running", 40, "LOW"), // vigorous: counts double = 80
      at("housework", 90, "MODERATE"), // a chore: ignored
      at("other", 90, "MODERATE"), // from before the catalog: ignored
      at("bodyweight-training", 20, "MODERATE", "2026-11-02"),
      at("bodyweight-training", 20, "MODERATE", "2026-11-04"),
    ]);
    expect(baseline.aerobicEquivalent).toBe((120 + 80) / 4);
    expect(baseline.strengthPerWeek).toBe(2 / 4);
    expect(baseline.hasHistory).toBe(true);
    expect(baseline.minutesByCode.housework).toBeUndefined();
    expect(baselineFrom([at("other", 30, "LOW")]).hasHistory).toBe(false);
  });

  it("starts the form from the days and length she already uses", () => {
    const at = (iso: string, minutes: number) => ({ activityCode: "walking", durationMinutes: minutes, intensity: "MODERATE" as const, date: new Date(`${iso}T00:00:00.000Z`) });
    // 2026-11-02 is a Monday, 11-04 a Wednesday, 11-06 a Friday.
    const defaults = defaultsFrom([at("2026-11-02", 30), at("2026-11-04", 30), at("2026-11-06", 40), at("2026-11-09", 30)]);
    expect(defaults.days).toEqual([1, 3, 5]);
    expect(defaults.sessionMinutes).toBe(30);
    expect(defaults.activityCodes).toEqual(["walking"]);
    expect(defaultsFrom([]).days).toEqual([1, 2, 4, 5, 6]);
    expect(defaultsFrom([]).sessionMinutes).toBe(45);
  });
});

describe("activity plan API", () => {
  it("needs sign-in", async () => {
    expect((await request(app).post("/api/v1/activity/plan/preview").send(body())).status).toBe(401);
    expect((await request(app).get(`/api/v1/activity/plan/active?today=${today()}`)).status).toBe(401);
  });

  it("offers the goals and a pre-filled form", async () => {
    const { token } = await signUp("plan-options");
    const res = await request(app).get(`/api/v1/activity/plan/options?today=${today()}`).set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.data.goals.map((g: { code: string }) => g.code)).toEqual(["HEALTH", "STRENGTH", "STAMINA", "BALANCE", "STRESS"]);
    expect(res.body.data.defaults).toMatchObject({ goal: "HEALTH", weeks: 8 });
    expect(res.body.data.baseline.hasHistory).toBe(false);
    expect(res.body.data.source.label).toMatch(/WHO/);
    expect(res.body.data.review.reviewed).toBe(false);
  });

  it("previews a plan without saving anything", async () => {
    const { token, id } = await signUp("plan-preview");
    const res = await preview(token);
    expect(res.status).toBe(200);
    expect(res.body.data.weeksPlan).toHaveLength(8);
    expect(res.body.data.feasibility.level).toBeDefined();
    expect(await prisma.activityPlan.count({ where: { userId: id } })).toBe(0);
    expect((await active(token)).body.data).toBeNull();
  });

  it("validates what she sends", async () => {
    const { token } = await signUp("plan-validate");
    expect((await preview(token, { goal: "LOSE_WEIGHT" })).status).toBe(422);
    expect((await preview(token, { weeks: 6 })).status).toBe(422);
    expect((await preview(token, { days: [] })).status).toBe(422);
    expect((await preview(token, { days: [1, 1, 3] })).status).toBe(422);
    expect((await preview(token, { days: [0, 8] })).status).toBe(422);
    expect((await preview(token, { sessionMinutes: 5 })).status).toBe(422);
    expect((await preview(token, { activityCodes: ["not-real"] })).status).toBe(422);
    expect((await preview(token, { startDate: addDays(today(), 30) })).status).toBe(400); // not a real "today" for anyone
  });

  it("saves a plan, shows it as active, and replaces it when she starts another", async () => {
    const { token, id } = await signUp("plan-start");
    const first = await start(token, { goal: "HEALTH" });
    expect(first.status).toBe(201);
    expect(first.body.data.status).toBe("ACTIVE");
    expect(first.body.data.progress).toMatchObject({ state: "ACTIVE", currentWeek: 1 });

    const second = await start(token, { goal: "STAMINA" });
    expect(second.status).toBe(201);
    const got = await active(token);
    expect(got.body.data.id).toBe(second.body.data.id);
    expect(got.body.data.plan.goal).toBe("STAMINA");
    const rows = await prisma.activityPlan.findMany({ where: { userId: id }, orderBy: { createdAt: "asc" } });
    expect(rows.map((r) => r.status)).toEqual(["ENDED", "ACTIVE"]);
    expect(rows[0].endedAt).not.toBeNull();
  });

  it("builds the plan itself and ignores anything else the client sends", async () => {
    const { token } = await signUp("plan-trust");
    const res = await request(app)
      .post("/api/v1/activity/plan")
      .set(auth(token))
      .send({ ...body(), plan: { goal: "STAMINA", weeksPlan: [] }, status: "ENDED" });
    expect(res.status).toBe(201);
    expect(res.body.data.plan.goal).toBe("HEALTH");
    expect(res.body.data.plan.weeksPlan).toHaveLength(8);
    expect(res.body.data.status).toBe("ACTIVE");
  });

  it("ticks a planned session off when she logs that kind of activity that day, and totals the week", async () => {
    const { token } = await signUp("plan-progress");
    // Started six days ago (the furthest back the app lets a day be filled in), so week 1 has days that have already passed.
    const started = await start(token, { days: [1, 2, 3, 4, 5, 6, 7], sessionMinutes: 45, startDate: addDays(today(), -6) });
    const week1 = started.body.data.plan.weeksPlan[0];
    const planned = week1.sessions.find((s: { date: string; kind: string }) => s.date <= today() && s.kind === "AEROBIC");
    expect(planned).toBeDefined();
    expect(planned.done).toBe(false);

    expect((await log(token, { durationMinutes: 40, date: planned.date })).status).toBe(201);
    const after = (await active(token)).body.data;
    const done = after.plan.weeksPlan[0].sessions.find((s: { date: string; kind: string }) => s.date === planned.date && s.kind === "AEROBIC");
    expect(done.done).toBe(true);
    expect(after.progress.weekDone.aerobicEquivalent).toBe(40);
    // Sessions on later days are not marked done.
    expect(after.plan.weeksPlan[0].sessions.filter((s: { date: string; done: boolean }) => s.date > today()).every((s: { done: boolean }) => !s.done)).toBe(true);
  });

  it("counts hard effort double toward the week, as the WHO does", async () => {
    const { token } = await signUp("plan-double");
    await start(token);
    await log(token, { activityCode: "running", intensity: "LOW", durationMinutes: 20 });
    expect((await active(token)).body.data.progress.weekDone.aerobicEquivalent).toBe(40);
  });

  it("lets her end her plan, and only her own", async () => {
    const owner = await signUp("plan-end-owner");
    const other = await signUp("plan-end-other");
    const planId = (await start(owner.token)).body.data.id as string;

    expect((await request(app).post(`/api/v1/activity/plan/${planId}/end`).set(auth(other.token))).status).toBe(404);
    expect((await active(owner.token)).body.data).not.toBeNull();
    expect((await active(other.token)).body.data).toBeNull();

    expect((await request(app).post(`/api/v1/activity/plan/${planId}/end`).set(auth(owner.token))).status).toBe(204);
    expect((await active(owner.token)).body.data).toBeNull();
    expect((await request(app).post(`/api/v1/activity/plan/${planId}/end`).set(auth(owner.token))).status).toBe(404);
  });

  it("includes plans in her data export and removes them with her account", async () => {
    const { token, id } = await signUp("plan-export");
    await start(token);
    const exported = await request(app).get("/api/v1/users/me/export").set(auth(token));
    expect(exported.body.data.activityPlans).toHaveLength(1);
    expect(exported.body.data.activityPlans[0].plan.weeksPlan).toHaveLength(8);
    await prisma.user.delete({ where: { id } });
    expect(await prisma.activityPlan.count({ where: { userId: id } })).toBe(0);
  });
});

describe("activity plan safety, from her own record", () => {
  it("keeps a pregnant woman to moderate effort and tells her to talk to her doctor first", async () => {
    const { token } = await signUp("plan-pregnant");
    expect((await request(app).put("/api/v1/users/me/reproductive-health").set(auth(token)).send({ pregnancyStatus: "PREGNANT" })).status).toBe(200);
    await log(token, { activityCode: "running", intensity: "MODERATE", durationMinutes: 30, date: addDays(today(), -3) });
    const res = await preview(token);
    expect(res.body.data.cautions[0]).toMatch(/pregnant/);
    const aerobic = res.body.data.weeksPlan.flatMap((w: { sessions: { kind: string; activityCode: string }[] }) => w.sessions).filter((s: { kind: string }) => s.kind === "AEROBIC");
    expect(aerobic.every((s: { activityCode: string }) => s.activityCode === "walking")).toBe(true);
    const options = await request(app).get(`/api/v1/activity/plan/options?today=${today()}`).set(auth(token));
    expect(options.body.data.aerobicActivities.find((a: { code: string }) => a.code === "running").available).toBe(false);
  });

  it("flags listed health conditions and asks for a doctor's check", async () => {
    const { token } = await signUp("plan-conditions");
    expect((await request(app).put("/api/v1/users/me/health-profile").set(auth(token)).send({ conditions: ["High blood pressure"] })).status).toBe(200);
    await log(token, { activityCode: "running", intensity: "MODERATE", durationMinutes: 30, date: addDays(today(), -3) });
    const res = await preview(token);
    expect(res.status).toBe(200);
    expect(res.body.data.cautions[0]).toMatch(/health conditions/);
    expect(res.body.data.cautions[0]).toMatch(/doctor/);
    // Hard efforts are left out even though she runs.
    const used = res.body.data.weeksPlan.flatMap((w: { sessions: { activityCode: string }[] }) => w.sessions.map((x) => x.activityCode));
    expect(used).not.toContain("running");
  });

  it("adds balance work for someone 65 or over", async () => {
    const { token } = await signUp("plan-older", { dateOfBirth: "1950-05-01" });
    const res = await preview(token);
    expect(res.body.data.cautions.join(" ")).toMatch(/65 or over/);
    expect(res.body.data.weeksPlan[5].strengthSessions).toBe(3);
  });

  it("refuses to build a plan for someone under 18", async () => {
    const { token } = await signUp("plan-minor", { dateOfBirth: `${new Date().getUTCFullYear() - 16}-01-01` });
    const res = await preview(token);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/18/);
  });

  it("estimates calories only once she has logged a weight", async () => {
    const { token } = await signUp("plan-weight");
    expect((await preview(token)).body.data.weeksPlan[0].sessions[0].caloriesEstimate).toBeNull();
    await request(app).post("/api/v1/health/vitals").set(auth(token)).send({ type: "WEIGHT", value: "62 kg", date: today() });
    expect((await preview(token)).body.data.weeksPlan[0].sessions[0].caloriesEstimate).toBeGreaterThan(0);
  });
});
