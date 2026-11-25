import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "@/app";

const app = createApp();
const PASSWORD = "a-long-enough-password";
const today = new Date().toISOString().slice(0, 10);

let ip = 150;
async function signUp(label: string) {
  const res = await request(app).post("/api/v1/auth/register").set("X-Forwarded-For", `203.0.113.${ip++}`).send({
    name: "Targets Tester",
    email: `${label}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`,
    password: PASSWORD,
    dateOfBirth: "1990-05-15",
  });
  expect(res.status).toBe(201);
  return { token: res.body.data.accessToken as string };
}
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const meal = (t: string, body: object) =>
  request(app).post("/api/v1/nutrition/meals").set(auth(t)).send({ date: today, time: "8:00 AM", name: "Lentils", calories: 300, proteinG: 18, fibreG: 8, servings: "1 bowl", ...body });
const targets = (t: string) => request(app).get(`/api/v1/nutrition/targets?date=${today}`).set(auth(t));

describe("nutrient targets", () => {
  it("starts with the four always-on targets and offers the rest, with no suggested amounts", async () => {
    const { token } = await signUp("nt-start");
    const res = await targets(token);
    expect(res.status).toBe(200);
    expect(res.body.data.targets.map((t: { code: string }) => t.code)).toEqual(["protein", "fibre", "water", "fruitveg"]);
    const codes = res.body.data.available.map((a: { code: string }) => a.code);
    expect(codes).toEqual(expect.arrayContaining(["carbs", "fat", "iron", "calcium", "sodium"]));
    // No calorie target is offered.
    expect(codes).not.toContain("calories");
    expect(res.body.data.available.find((a: { code: string }) => a.code === "sodium").usuallyAtMost).toBe(true);
  });

  it("sets a macro target and a micro target and sums today's totals from meals", async () => {
    const { token } = await signUp("nt-sum");
    await request(app).put("/api/v1/nutrition/targets/carbs").set(auth(token)).send({ amount: 200 }).expect(200);
    await request(app).put("/api/v1/nutrition/targets/iron").set(auth(token)).send({ amount: 18, mode: "AT_LEAST" }).expect(200);
    await request(app).put("/api/v1/nutrition/targets/sodium").set(auth(token)).send({ amount: 2000, mode: "AT_MOST" }).expect(200);
    expect((await meal(token, { carbsG: 40.5, micros: { iron: 3.2, sodium: 400 } })).status).toBe(201);
    expect((await meal(token, { name: "Rice", carbsG: 60, micros: { iron: 1.1 } })).status).toBe(201);
    const res = await targets(token);
    const by = (code: string) => res.body.data.targets.find((t: { code: string }) => t.code === code);
    expect(by("carbs")).toMatchObject({ amount: 200, total: 100.5, mode: "AT_LEAST" });
    expect(by("iron")).toMatchObject({ amount: 18, total: 4.3 });
    expect(by("sodium")).toMatchObject({ amount: 2000, total: 400, mode: "AT_MOST" });
    expect(by("protein").total).toBe(36);
    expect(res.body.data.available.map((a: { code: string }) => a.code)).not.toContain("iron");
  });

  it("changes the always-on targets in place and refuses to remove them", async () => {
    const { token } = await signUp("nt-legacy");
    await request(app).put("/api/v1/nutrition/targets/protein").set(auth(token)).send({ amount: 55 }).expect(200);
    const res = await targets(token);
    expect(res.body.data.targets.find((t: { code: string }) => t.code === "protein")).toMatchObject({ amount: 55, usual: false });
    expect((await request(app).delete("/api/v1/nutrition/targets/protein").set(auth(token))).status).toBe(400);
    await request(app).put("/api/v1/nutrition/targets/zinc").set(auth(token)).send({ amount: 8 }).expect(200);
    await request(app).delete("/api/v1/nutrition/targets/zinc").set(auth(token)).expect(204);
    expect((await targets(token)).body.data.available.map((a: { code: string }) => a.code)).toContain("zinc");
  });

  it("refuses impossible amounts, unknown nutrients and unknown micros on a meal", async () => {
    const { token } = await signUp("nt-bad");
    expect((await request(app).put("/api/v1/nutrition/targets/iron").set(auth(token)).send({ amount: 0 })).status).toBe(422);
    expect((await request(app).put("/api/v1/nutrition/targets/iron").set(auth(token)).send({ amount: 5000 })).status).toBe(400);
    expect((await request(app).put("/api/v1/nutrition/targets/iron").set(auth(token)).send({ amount: 1.25 })).status).toBe(400);
    expect((await request(app).put("/api/v1/nutrition/targets/water").set(auth(token)).send({ amount: 1500.5 })).status).toBe(400);
    expect((await request(app).put("/api/v1/nutrition/targets/calories").set(auth(token)).send({ amount: 1800 })).status).toBe(404);
    expect((await meal(token, { micros: { iron: 2, magic: 5 } })).status).toBe(422);
    expect((await meal(token, { micros: { iron: -1 } })).status).toBe(422);
    expect((await meal(token, { micros: { protein: 5 } })).status).toBe(422);
  });

  it("keeps micros on edit, clears them with null, and only touches her own data", async () => {
    const a = await signUp("nt-a");
    const b = await signUp("nt-b");
    const created = (await meal(a.token, { micros: { calcium: 100 } })).body.data;
    await request(app).patch(`/api/v1/nutrition/meals/${created.id}`).set(auth(a.token)).send({ name: "Lentil soup" }).expect(200);
    await request(app).put("/api/v1/nutrition/targets/calcium").set(auth(a.token)).send({ amount: 1000 }).expect(200);
    expect((await targets(a.token)).body.data.targets.find((t: { code: string }) => t.code === "calcium").total).toBe(100);
    await request(app).patch(`/api/v1/nutrition/meals/${created.id}`).set(auth(a.token)).send({ micros: null }).expect(200);
    expect((await targets(a.token)).body.data.targets.find((t: { code: string }) => t.code === "calcium").total).toBe(0);
    // Another account sees none of it.
    expect((await targets(b.token)).body.data.available.map((x: { code: string }) => x.code)).toContain("calcium");
    expect((await request(app).get("/api/v1/nutrition/targets")).status).toBe(401);
  });

  it("comes with her data download", async () => {
    const { token } = await signUp("nt-export");
    await request(app).put("/api/v1/nutrition/targets/fat").set(auth(token)).send({ amount: 60, mode: "AT_MOST" }).expect(200);
    await request(app).put("/api/v1/activity/targets/WALKING").set(auth(token)).send({ minutes: 30, period: "DAY" }).expect(200);
    const exported = (await request(app).get("/api/v1/users/me/export").set(auth(token))).body;
    const data = exported.data ?? exported;
    expect(data.nutrientTargets).toEqual([expect.objectContaining({ nutrient: "fat", amount: 60, mode: "AT_MOST" })]);
    expect(data.activityTargets).toEqual([expect.objectContaining({ category: "WALKING", minutes: 30, period: "DAY" })]);
  });
});

describe("activity minutes targets", () => {
  const log = (t: string, body: object) =>
    request(app).post("/api/v1/activity/entries").set(auth(t)).send({ date: today, activityCode: "walking", durationMinutes: 20, intensity: "MODERATE", ...body });
  const get = (t: string) => request(app).get(`/api/v1/activity/targets?date=${today}`).set(auth(t));

  it("offers every kind of movement, including physiotherapy, with no target to begin with", async () => {
    const { token } = await signUp("at-start");
    const res = await get(token);
    expect(res.body.data.targets).toEqual([]);
    expect(res.body.data.available.map((a: { category: string }) => a.category)).toEqual(["WALKING", "CARDIO", "STRENGTH", "FLEXIBILITY", "PHYSIO"]);
    const catalog = (await request(app).get("/api/v1/activity/catalog").set(auth(token))).body.data;
    expect(catalog.activities.find((a: { code: string }) => a.code === "physiotherapy")).toBeTruthy();
  });

  it("counts logged minutes toward the right kind, for the day or the week", async () => {
    const { token } = await signUp("at-count");
    await request(app).put("/api/v1/activity/targets/WALKING").set(auth(token)).send({ minutes: 30, period: "DAY" }).expect(200);
    await request(app).put("/api/v1/activity/targets/CARDIO").set(auth(token)).send({ minutes: 150, period: "WEEK" }).expect(200);
    await request(app).put("/api/v1/activity/targets/PHYSIO").set(auth(token)).send({ minutes: 60, period: "WEEK" }).expect(200);
    expect((await log(token, {})).status).toBe(201);
    expect((await log(token, { activityCode: "hiking", durationMinutes: 15 })).status).toBe(201);
    expect((await log(token, { activityCode: "running", durationMinutes: 25, intensity: "LOW" })).status).toBe(201);
    expect((await log(token, { activityCode: "cycling", durationMinutes: 40, intensity: "LOW" })).status).toBe(201);
    const physio = await log(token, { activityCode: "physiotherapy", durationMinutes: 25, intensity: "LOW" });
    expect(physio.status).toBe(201);
    // Physiotherapy has no calorie estimate, ever: there is no honest MET value for prescribed rehab.
    expect(physio.body.data.caloriesBurned ?? null).toBeNull();
    const by = (res: { body: { data: { targets: { category: string }[] } } }, c: string) => res.body.data.targets.find((t) => t.category === c);
    const res = await get(token);
    expect(by(res, "WALKING")).toMatchObject({ minutes: 30, period: "DAY", done: 35 });
    expect(by(res, "CARDIO")).toMatchObject({ done: 65 });
    expect(by(res, "PHYSIO")).toMatchObject({ done: 25 });
    expect(res.body.data.available.map((a: { category: string }) => a.category)).toEqual(["STRENGTH", "FLEXIBILITY"]);
  });

  it("ignores minutes from before the period and from other kinds, and can be changed and removed", async () => {
    const { token } = await signUp("at-period");
    await request(app).put("/api/v1/activity/targets/STRENGTH").set(auth(token)).send({ minutes: 20, period: "DAY" }).expect(200);
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    await log(token, { activityCode: "strength-training", durationMinutes: 30, intensity: "LOW", date: yesterday, sets: 3 });
    await log(token, { activityCode: "yoga", durationMinutes: 30, intensity: "LOW" });
    expect((await get(token)).body.data.targets[0].done).toBe(0);
    await request(app).put("/api/v1/activity/targets/STRENGTH").set(auth(token)).send({ minutes: 60, period: "WEEK" }).expect(200);
    const after = (await get(token)).body.data.targets[0];
    expect(after.minutes).toBe(60);
    await request(app).delete("/api/v1/activity/targets/STRENGTH").set(auth(token)).expect(204);
    expect((await get(token)).body.data.targets).toEqual([]);
  });

  it("refuses impossible targets and needs sign-in", async () => {
    const { token } = await signUp("at-bad");
    expect((await request(app).put("/api/v1/activity/targets/WALKING").set(auth(token)).send({ minutes: 0, period: "DAY" })).status).toBe(422);
    expect((await request(app).put("/api/v1/activity/targets/WALKING").set(auth(token)).send({ minutes: 2000, period: "DAY" })).status).toBe(422);
    expect((await request(app).put("/api/v1/activity/targets/WALKING").set(auth(token)).send({ minutes: 30, period: "YEAR" })).status).toBe(422);
    expect((await request(app).put("/api/v1/activity/targets/SWIMMING").set(auth(token)).send({ minutes: 30, period: "DAY" })).status).toBe(422);
    expect((await request(app).get("/api/v1/activity/targets")).status).toBe(401);
  });
});
