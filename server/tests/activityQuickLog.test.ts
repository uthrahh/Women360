import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "@/app";
import {
  ACTIVITIES,
  activityByCode,
  caloriesFor,
  formatDuration,
  levelKeys,
  parseWeightKg,
  quickLogLabel,
  resolveLevel,
} from "@/modules/activity/catalog";

const app = createApp();
const PASSWORD = "a-long-enough-password";
const today = () => new Date().toISOString().slice(0, 10);

let ip = 20;
async function signUp(label: string) {
  // Each sign-up comes from its own address so the sign-in rate limit (20 per 15 minutes per address) never trips.
  const res = await request(app).post("/api/v1/auth/register").set("X-Forwarded-For", `203.0.113.${ip++}`).send({
    name: "Activity Tester",
    email: `${label}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`,
    password: PASSWORD,
  });
  expect(res.status).toBe(201);
  return res.body.data.accessToken as string;
}
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const quick = (t: string) => request(app).get("/api/v1/activity/quick-log").set(auth(t));
const addQuick = (t: string, body: object) => request(app).post("/api/v1/activity/quick-log").set(auth(t)).send(body);
const logEntry = (t: string, body: object = {}) =>
  request(app)
    .post("/api/v1/activity/entries")
    .set(auth(t))
    .send({ date: today(), activityCode: "walking", durationMinutes: 15, intensity: "LOW", ...body });
const setWeight = (t: string, value: string) =>
  request(app).post("/api/v1/health/vitals").set(auth(t)).send({ type: "WEIGHT", value, date: today() });
const summary = (t: string) => request(app).get("/api/v1/activity/summary").set(auth(t));

describe("activity catalog", () => {
  it("has unique codes and every level traced to a Compendium code", () => {
    const codes = ACTIVITIES.map((a) => a.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const a of ACTIVITIES) {
      const keys = levelKeys(a);
      expect(keys.length).toBeGreaterThan(0);
      for (const k of keys) {
        expect(a.levels[k]!.code).toMatch(/^\d{5}$/);
        expect(a.levels[k]!.met).toBeGreaterThan(1);
      }
      const mets = keys.map((k) => a.levels[k]!.met);
      expect([...mets].sort((x, y) => x - y)).toEqual(mets); // harder is never a lower MET
    }
  });

  it("estimates calories as MET x kilograms x hours", () => {
    expect(caloriesFor("walking", "MODERATE", 60, 60)).toBe(258); // 4.3 x 60 x 1
    expect(caloriesFor("running", "MODERATE", 30, 70)).toBe(343); // 9.8 x 70 x 0.5
    expect(caloriesFor("yoga", "LOW", 90, 50)).toBe(188); // 2.5 x 50 x 1.5
  });

  it("gives no estimate without a weight or for an unknown activity", () => {
    expect(caloriesFor("walking", "LOW", 30, null)).toBeNull();
    expect(caloriesFor("not-a-thing", "LOW", 30, 60)).toBeNull();
    expect(caloriesFor("walking", "LOW", 0, 60)).toBeNull();
  });

  it("uses the nearest level for an older entry whose effort the activity doesn't have", () => {
    const pilates = activityByCode("pilates")!;
    expect(resolveLevel(pilates, "LOW").met).toBe(3.0);
    expect(resolveLevel(pilates, "HIGH").met).toBe(3.0);
  });

  it("reads a logged weight in kilograms or pounds and rejects nonsense", () => {
    expect(parseWeightKg("63.4 kg")).toBe(63.4);
    expect(parseWeightKg("63")).toBe(63);
    expect(parseWeightKg("140 lb")).toBe(63.5);
    expect(parseWeightKg("63,5kg")).toBe(63.5);
    expect(parseWeightKg("heavy")).toBeNull();
    expect(parseWeightKg("5 kg")).toBeNull();
    expect(parseWeightKg("")).toBeNull();
  });

  it("writes readable durations and shortcut labels", () => {
    expect(formatDuration(30)).toBe("30 min");
    expect(formatDuration(60)).toBe("1 h");
    expect(formatDuration(65)).toBe("1 h 5 min");
    expect(quickLogLabel(activityByCode("walking")!, "MODERATE", 30)).toBe("30 min walking, brisk");
    expect(quickLogLabel(activityByCode("pilates")!, "MODERATE", 45)).toBe("45 min pilates");
  });
});

describe("activity catalog API", () => {
  it("is served to signed-in people with its source", async () => {
    const t = await signUp("cat-get");
    const res = await request(app).get("/api/v1/activity/catalog").set(auth(t));
    expect(res.status).toBe(200);
    expect(res.body.data.source.label).toMatch(/Compendium/);
    const walking = res.body.data.activities.find((a: { code: string }) => a.code === "walking");
    expect(walking.levels.map((l: { key: string }) => l.key)).toEqual(["LOW", "MODERATE", "HIGH"]);
    expect(walking.extras).toEqual(["distanceKm"]);
    expect((await request(app).get("/api/v1/activity/catalog")).status).toBe(401);
  });
});

describe("activity quick log", () => {
  it("starts with the defaults, copied once, each a known activity", async () => {
    const t = await signUp("ql-default");
    const first = await quick(t);
    expect(first.status).toBe(200);
    expect(first.body.data.length).toBe(6);
    expect(first.body.data.every((i: { activityCode: string }) => activityByCode(i.activityCode))).toBe(true);
    expect(first.body.data[0].label).toBe("15 min walking, easy");
    expect((await quick(t)).body.data.length).toBe(6);
  });

  it("lets her add one and remove any, and a removed default stays removed", async () => {
    const t = await signUp("ql-edit");
    const list = (await quick(t)).body.data;
    expect((await request(app).delete(`/api/v1/activity/quick-log/${list[0].id}`).set(auth(t))).status).toBe(204);
    const added = await addQuick(t, { activityCode: "swimming", durationMinutes: 45, intensity: "HIGH" });
    expect(added.status).toBe(201);
    expect(added.body.data.label).toBe("45 min swimming, fast");
    const after = (await quick(t)).body.data;
    expect(after.length).toBe(6);
    expect(after.some((i: { id: string }) => i.id === list[0].id)).toBe(false);
  });

  it("refuses the same activity, length and effort twice", async () => {
    const t = await signUp("ql-dup");
    await quick(t);
    const dup = await addQuick(t, { activityCode: "walking", durationMinutes: 30, intensity: "MODERATE" }); // already a default
    expect(dup.status).toBe(409);
    expect(dup.body.error.message).toMatch(/already in your quick log/i);
    expect((await addQuick(t, { activityCode: "walking", durationMinutes: 31, intensity: "MODERATE" })).status).toBe(201);
    expect((await addQuick(t, { activityCode: "walking", durationMinutes: 30, intensity: "HIGH" })).status).toBe(201);
    expect((await quick(t)).body.data.length).toBe(8);
  });

  it("refuses two identical requests racing each other", async () => {
    const t = await signUp("ql-race");
    await quick(t);
    const body = { activityCode: "tennis", durationMinutes: 40, intensity: "MODERATE" };
    const results = await Promise.all([addQuick(t, body), addQuick(t, body), addQuick(t, body)]);
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(2);
  });

  it("emptying the list does not bring the defaults back", async () => {
    const t = await signUp("ql-empty");
    for (const i of (await quick(t)).body.data) await request(app).delete(`/api/v1/activity/quick-log/${i.id}`).set(auth(t));
    expect((await quick(t)).body.data).toEqual([]);
  });

  it("adding before ever opening the list still gets the defaults first", async () => {
    const t = await signUp("ql-first-add");
    await addQuick(t, { activityCode: "pilates", durationMinutes: 5, intensity: "MODERATE" });
    expect((await quick(t)).body.data.length).toBe(7);
  });

  it("caps the list and validates input", async () => {
    const t = await signUp("ql-cap");
    for (let i = 0; i < 14; i++) {
      expect((await addQuick(t, { activityCode: "walking", durationMinutes: 40 + i, intensity: "LOW" })).status).toBe(201);
    }
    expect((await addQuick(t, { activityCode: "walking", durationMinutes: 99, intensity: "LOW" })).status).toBe(400);
    expect((await addQuick(t, { activityCode: "swim-ish", durationMinutes: 10, intensity: "LOW" })).status).toBe(422);
    expect((await addQuick(t, { activityCode: "walking", durationMinutes: 0, intensity: "LOW" })).status).toBe(422);
    expect((await addQuick(t, { activityCode: "pilates", durationMinutes: 10, intensity: "LOW" })).status).toBe(422); // pilates has one level
  });

  it("keeps one person's quick log from another's", async () => {
    const a = await signUp("ql-a");
    const b = await signUp("ql-b");
    const item = (await quick(a)).body.data[0];
    expect((await request(app).delete(`/api/v1/activity/quick-log/${item.id}`).set(auth(b))).status).toBe(403);
    expect((await quick(a)).body.data.length).toBe(6);
  });

  it("shows calories on each shortcut once she has a weight", async () => {
    const t = await signUp("ql-cal");
    expect((await quick(t)).body.data[1].caloriesBurned).toBeNull();
    await setWeight(t, "60 kg");
    const walking30 = (await quick(t)).body.data.find((i: { label: string }) => i.label === "30 min walking, brisk");
    expect(walking30.caloriesBurned).toBe(129); // 4.3 x 60 x 0.5
  });
});

describe("logging and editing an activity", () => {
  it("records the activity, effort, distance and the calories it burned", async () => {
    const t = await signUp("ae-log");
    await setWeight(t, "60 kg");
    const res = await logEntry(t, { durationMinutes: 60, intensity: "MODERATE", distanceKm: 5.5 });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ activityCode: "walking", type: "Walking", durationMinutes: 60, distanceKm: 5.5, caloriesBurned: 258 });
    const s = await summary(t);
    expect(s.body.data.weightKg).toBe(60);
    expect(s.body.data.entries[0].caloriesBurned).toBe(258);
  });

  it("gives no calorie estimate, and says so, until she logs a weight", async () => {
    const t = await signUp("ae-noweight");
    const res = await logEntry(t);
    expect(res.body.data.caloriesBurned).toBeNull();
    expect((await summary(t)).body.data.weightKg).toBeNull();
  });

  it("only accepts details the activity has", async () => {
    const t = await signUp("ae-extras");
    expect((await logEntry(t, { activityCode: "yoga", distanceKm: 3 })).status).toBe(422);
    expect((await logEntry(t, { activityCode: "walking", sets: 3 })).status).toBe(422);
    const lifting = await logEntry(t, { activityCode: "strength-training", intensity: "HIGH", sets: 12 });
    expect(lifting.status).toBe(201);
    expect(lifting.body.data.sets).toBe(12);
  });

  it("rejects an effort the activity doesn't have, an unknown activity and a zero duration", async () => {
    const t = await signUp("ae-bad");
    expect((await logEntry(t, { activityCode: "pilates", intensity: "HIGH" })).status).toBe(422);
    expect((await logEntry(t, { activityCode: "levitation" })).status).toBe(422);
    expect((await logEntry(t, { durationMinutes: 0 })).status).toBe(422);
    expect((await logEntry(t, { durationMinutes: 1441 })).status).toBe(422);
  });

  it("edits type, length, effort, day and notes, and recalculates the calories", async () => {
    const t = await signUp("ae-edit");
    await setWeight(t, "60 kg");
    const id = (await logEntry(t)).body.data.id;
    const res = await request(app)
      .patch(`/api/v1/activity/entries/${id}`)
      .set(auth(t))
      .send({ activityCode: "running", durationMinutes: 30, intensity: "HIGH", notes: "Felt good", date: "2026-01-05" });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ activityCode: "running", type: "Running", durationMinutes: 30, intensity: "HIGH", notes: "Felt good", caloriesBurned: 330 });
    expect(res.body.data.date.slice(0, 10)).toBe("2026-01-05");
  });

  it("drops a distance when the activity changes to one without distance", async () => {
    const t = await signUp("ae-switch");
    const id = (await logEntry(t, { distanceKm: 4 })).body.data.id;
    const res = await request(app).patch(`/api/v1/activity/entries/${id}`).set(auth(t)).send({ activityCode: "yoga" });
    expect(res.status).toBe(200);
    expect(res.body.data.distanceKm).toBeNull();
  });

  it("checks the result of an edit: pilates has no easy level", async () => {
    const t = await signUp("ae-merge");
    const id = (await logEntry(t)).body.data.id; // walking, LOW
    const res = await request(app).patch(`/api/v1/activity/entries/${id}`).set(auth(t)).send({ activityCode: "pilates" });
    expect(res.status).toBe(400);
  });

  it("rejects an empty or invalid change", async () => {
    const t = await signUp("ae-empty");
    const id = (await logEntry(t)).body.data.id;
    expect((await request(app).patch(`/api/v1/activity/entries/${id}`).set(auth(t)).send({})).status).toBe(422);
    expect((await request(app).patch(`/api/v1/activity/entries/${id}`).set(auth(t)).send({ durationMinutes: -3 })).status).toBe(422);
  });

  it("will not edit someone else's entry", async () => {
    const a = await signUp("ae-a");
    const b = await signUp("ae-b");
    const id = (await logEntry(a)).body.data.id;
    expect((await request(app).patch(`/api/v1/activity/entries/${id}`).set(auth(b)).send({ durationMinutes: 5 })).status).toBe(403);
    expect((await request(app).patch("/api/v1/activity/entries/nope").set(auth(a)).send({ durationMinutes: 5 })).status).toBe(404);
  });

  it("includes the quick log in the data export", async () => {
    const t = await signUp("ae-export");
    await quick(t);
    const exported = await request(app).get("/api/v1/users/me/export").set(auth(t));
    expect(exported.body.data.activityQuickLogs.length).toBe(6);
  });
});
