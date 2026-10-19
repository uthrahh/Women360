import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "@/app";

const app = createApp();
const PASSWORD = "a-long-enough-password";

const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

async function signUp(label: string) {
  const res = await request(app).post("/api/v1/auth/register").send({
    name: "Habit Tester",
    email: `${label}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`,
    password: PASSWORD,
  });
  expect(res.status).toBe(201);
  return res.body.data.accessToken as string;
}
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const make = (token: string, body: object) => request(app).post("/api/v1/habits").set(auth(token)).send(body);
const logDay = (token: string, id: string, date: string, body: object = {}) =>
  request(app).put(`/api/v1/habits/${id}/logs/${date}`).set(auth(token)).send(body);

describe("habits: creating", () => {
  it("makes a simple tick-it-off habit that defaults to every day", async () => {
    const token = await signUp("h-create");
    const res = await make(token, { title: "Take my vitamin" });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ title: "Take my vitamin", target: null, daysPerWeek: 7, doneToday: false, streak: 0, streakUnit: "day" });
    expect(res.body.data.last7).toHaveLength(7);
  });

  it("makes an amount habit with a target and unit", async () => {
    const token = await signUp("h-amount");
    const res = await make(token, { title: "Walk", target: 10000, unit: "steps" });
    expect(res.body.data).toMatchObject({ target: 10000, unit: "steps" });
  });

  it("ignores a unit on a habit with no target", async () => {
    const token = await signUp("h-unit");
    const res = await make(token, { title: "Stretch", unit: "min" });
    expect(res.body.data.unit).toBeNull();
  });

  it("validates title, target and days per week", async () => {
    const token = await signUp("h-bad");
    expect((await make(token, { title: "" })).status).toBe(422);
    expect((await make(token, { title: "x", target: 0 })).status).toBe(422);
    expect((await make(token, { title: "x", daysPerWeek: 0 })).status).toBe(422);
    expect((await make(token, { title: "x", daysPerWeek: 8 })).status).toBe(422);
  });

  it("caps the number of active habits", async () => {
    const token = await signUp("h-cap");
    for (let i = 0; i < 30; i++) expect((await make(token, { title: `Habit ${i}` })).status).toBe(201);
    expect((await make(token, { title: "One too many" })).status).toBe(400);
  });
});

describe("habits: logging", () => {
  it("one tap on a tick habit marks the day done and builds a streak", async () => {
    const token = await signUp("h-log");
    const id = (await make(token, { title: "Meditate" })).body.data.id;
    for (const n of [2, 1, 0]) expect((await logDay(token, id, day(n))).status).toBe(200);
    const list = await request(app).get(`/api/v1/habits?today=${day(0)}`).set(auth(token));
    const h = list.body.data.find((x: { id: string }) => x.id === id);
    expect(h).toMatchObject({ doneToday: true, streak: 3, streakUnit: "day" });
    expect(h.last7.slice(-3)).toEqual([true, true, true]);
    expect(h.last7.slice(0, 4)).toEqual([false, false, false, false]);
  });

  it("logging an amount habit with no amount records the target (one tap = done)", async () => {
    const token = await signUp("h-tap");
    const id = (await make(token, { title: "Water", target: 8, unit: "glasses" })).body.data.id;
    const res = await logDay(token, id, day(0));
    expect(res.body.data).toMatchObject({ doneToday: true, amountToday: 8 });
  });

  it("a partial amount is progress, not done, and a full one completes it", async () => {
    const token = await signUp("h-partial");
    const id = (await make(token, { title: "Walk", target: 10000, unit: "steps" })).body.data.id;
    const part = await logDay(token, id, day(0), { amount: 6200 });
    expect(part.body.data).toMatchObject({ doneToday: false, amountToday: 6200, streak: 0 });
    const full = await logDay(token, id, day(0), { amount: 10400 });
    expect(full.body.data).toMatchObject({ doneToday: true, amountToday: 10400, streak: 1 });
  });

  it("is idempotent and can be undone", async () => {
    const token = await signUp("h-idem");
    const id = (await make(token, { title: "Floss" })).body.data.id;
    await logDay(token, id, day(0));
    const again = await logDay(token, id, day(0));
    expect(again.body.data.streak).toBe(1);
    const undone = await request(app).delete(`/api/v1/habits/${id}/logs/${day(0)}`).set(auth(token));
    expect(undone.body.data).toMatchObject({ doneToday: false, streak: 0 });
  });

  it("a missed day ends a daily streak, with no penalty state", async () => {
    const token = await signUp("h-miss");
    const id = (await make(token, { title: "Journal" })).body.data.id;
    await logDay(token, id, day(3));
    await logDay(token, id, day(2));
    const list = await request(app).get(`/api/v1/habits?today=${day(0)}`).set(auth(token));
    expect(list.body.data[0].streak).toBe(0);
  });

  it("counts weeks for an N-days-a-week habit", async () => {
    const token = await signUp("h-week");
    const id = (await make(token, { title: "Strength", daysPerWeek: 3 })).body.data.id;
    const res = await logDay(token, id, day(0));
    expect(res.body.data).toMatchObject({ streakUnit: "week", thisWeek: 1 });
  });

  it("rejects future, far-past and malformed days", async () => {
    const token = await signUp("h-days");
    const id = (await make(token, { title: "Walk" })).body.data.id;
    expect((await logDay(token, id, day(-5))).status).toBe(400);
    expect((await logDay(token, id, day(30))).status).toBe(400);
    expect((await logDay(token, id, "tomorrow")).status).toBe(422);
  });
});

describe("habits: editing and removing", () => {
  it("edits a habit and archives it out of the list", async () => {
    const token = await signUp("h-edit");
    const id = (await make(token, { title: "Walk", target: 5000, unit: "steps" })).body.data.id;
    const edited = await request(app).patch(`/api/v1/habits/${id}`).set(auth(token)).send({ target: 8000 });
    expect(edited.body.data.target).toBe(8000);
    const cleared = await request(app).patch(`/api/v1/habits/${id}`).set(auth(token)).send({ target: null });
    expect(cleared.body.data).toMatchObject({ target: null, unit: null });
    await request(app).patch(`/api/v1/habits/${id}`).set(auth(token)).send({ archived: true });
    const list = await request(app).get("/api/v1/habits").set(auth(token));
    expect(list.body.data).toHaveLength(0);
  });

  it("deleting removes its logs", async () => {
    const token = await signUp("h-del");
    const id = (await make(token, { title: "Walk" })).body.data.id;
    await logDay(token, id, day(0));
    expect((await request(app).delete(`/api/v1/habits/${id}`).set(auth(token))).status).toBe(204);
    expect((await request(app).get("/api/v1/habits").set(auth(token))).body.data).toHaveLength(0);
  });
});

describe("habits: access control", () => {
  it("requires sign-in", async () => {
    expect((await request(app).get("/api/v1/habits")).status).toBe(401);
    expect((await request(app).post("/api/v1/habits").send({ title: "x" })).status).toBe(401);
  });

  it("keeps each person's habits to themselves", async () => {
    const a = await signUp("h-iso-a");
    const b = await signUp("h-iso-b");
    const id = (await make(a, { title: "A's private habit" })).body.data.id;
    expect(JSON.stringify((await request(app).get("/api/v1/habits").set(auth(b))).body)).not.toContain("A's private habit");
    expect((await logDay(b, id, day(0))).status).toBe(403);
    expect((await request(app).patch(`/api/v1/habits/${id}`).set(auth(b)).send({ title: "mine now" })).status).toBe(403);
    expect((await request(app).delete(`/api/v1/habits/${id}`).set(auth(b))).status).toBe(403);
    expect((await request(app).delete(`/api/v1/habits/${id}/logs/${day(0)}`).set(auth(b))).status).toBe(403);
  });

  it("appears in the person's data export", async () => {
    const token = await signUp("h-export");
    const id = (await make(token, { title: "Exported habit" })).body.data.id;
    await logDay(token, id, day(0));
    const res = await request(app).get("/api/v1/users/me/export").set(auth(token));
    expect(res.body.data.habits[0]).toMatchObject({ title: "Exported habit" });
    expect(res.body.data.habits[0].logs).toHaveLength(1);
  });
});
