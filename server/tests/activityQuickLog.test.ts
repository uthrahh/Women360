import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "@/app";

const app = createApp();
const PASSWORD = "a-long-enough-password";
const today = () => new Date().toISOString().slice(0, 10);

async function signUp(label: string) {
  const res = await request(app).post("/api/v1/auth/register").send({
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
  request(app).post("/api/v1/activity/entries").set(auth(t)).send({ date: today(), type: "Walk", durationMinutes: 15, intensity: "LOW", ...body });

describe("activity quick log", () => {
  it("starts with the defaults, copied once", async () => {
    const t = await signUp("ql-default");
    const first = await quick(t);
    expect(first.status).toBe(200);
    expect(first.body.data.length).toBe(6);
    const second = await quick(t);
    expect(second.body.data.length).toBe(6);
  });

  it("lets her add one and remove any, and a removed default stays removed", async () => {
    const t = await signUp("ql-edit");
    const list = (await quick(t)).body.data;
    const del = await request(app).delete(`/api/v1/activity/quick-log/${list[0].id}`).set(auth(t));
    expect(del.status).toBe(204);
    const added = await addQuick(t, { label: "45-min swim", type: "Swimming", durationMinutes: 45, intensity: "HIGH" });
    expect(added.status).toBe(201);
    const after = (await quick(t)).body.data;
    expect(after.length).toBe(6);
    expect(after.some((i: { label: string }) => i.label === "45-min swim")).toBe(true);
    expect(after.some((i: { id: string }) => i.id === list[0].id)).toBe(false);
  });

  it("emptying the list does not bring the defaults back", async () => {
    const t = await signUp("ql-empty");
    for (const i of (await quick(t)).body.data) await request(app).delete(`/api/v1/activity/quick-log/${i.id}`).set(auth(t));
    expect((await quick(t)).body.data).toEqual([]);
  });

  it("adding before ever opening the list still gets the defaults first", async () => {
    const t = await signUp("ql-first-add");
    await addQuick(t, { label: "5-min stretch", type: "Stretch", durationMinutes: 5, intensity: "LOW" });
    expect((await quick(t)).body.data.length).toBe(7);
  });

  it("caps the list and validates input", async () => {
    const t = await signUp("ql-cap");
    for (let i = 0; i < 14; i++) {
      expect((await addQuick(t, { label: `Item ${i}`, type: "Walk", durationMinutes: 10, intensity: "LOW" })).status).toBe(201);
    }
    expect((await addQuick(t, { label: "One too many", type: "Walk", durationMinutes: 10, intensity: "LOW" })).status).toBe(400);
    expect((await addQuick(t, { label: "", type: "Walk", durationMinutes: 10, intensity: "LOW" })).status).toBe(422);
    expect((await addQuick(t, { label: "Zero", type: "Walk", durationMinutes: 0, intensity: "LOW" })).status).toBe(422);
  });

  it("keeps one person's quick log from another's", async () => {
    const a = await signUp("ql-a");
    const b = await signUp("ql-b");
    const item = (await quick(a)).body.data[0];
    expect((await request(app).delete(`/api/v1/activity/quick-log/${item.id}`).set(auth(b))).status).toBe(403);
    expect((await quick(a)).body.data.length).toBe(6);
  });
});

describe("editing an activity entry", () => {
  it("changes type, duration, intensity, notes and day", async () => {
    const t = await signUp("ae-edit");
    const id = (await logEntry(t)).body.data.id;
    const res = await request(app)
      .patch(`/api/v1/activity/entries/${id}`)
      .set(auth(t))
      .send({ type: "Brisk walk", durationMinutes: 40, intensity: "MODERATE", notes: "Felt good", date: "2026-01-05" });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ type: "Brisk walk", durationMinutes: 40, intensity: "MODERATE", notes: "Felt good" });
    expect(res.body.data.date.slice(0, 10)).toBe("2026-01-05");
  });

  it("changes only what is sent", async () => {
    const t = await signUp("ae-partial");
    const id = (await logEntry(t, { type: "Yoga", durationMinutes: 20 })).body.data.id;
    const res = await request(app).patch(`/api/v1/activity/entries/${id}`).set(auth(t)).send({ durationMinutes: 25 });
    expect(res.body.data).toMatchObject({ type: "Yoga", durationMinutes: 25 });
  });

  it("rejects an empty or invalid change", async () => {
    const t = await signUp("ae-bad");
    const id = (await logEntry(t)).body.data.id;
    expect((await request(app).patch(`/api/v1/activity/entries/${id}`).set(auth(t)).send({})).status).toBe(422);
    expect((await request(app).patch(`/api/v1/activity/entries/${id}`).set(auth(t)).send({ durationMinutes: -3 })).status).toBe(422);
  });

  it("will not edit someone else's entry", async () => {
    const a = await signUp("ae-a");
    const b = await signUp("ae-b");
    const id = (await logEntry(a)).body.data.id;
    expect((await request(app).patch(`/api/v1/activity/entries/${id}`).set(auth(b)).send({ type: "Hacked" })).status).toBe(403);
    expect((await request(app).patch(`/api/v1/activity/entries/nope`).set(auth(a)).send({ type: "x" })).status).toBe(404);
  });

  it("includes the quick log in the data export", async () => {
    const t = await signUp("ae-export");
    await quick(t);
    const exported = await request(app).get("/api/v1/users/me/export").set(auth(t));
    expect(exported.body.data.activityQuickLogs.length).toBe(6);
  });
});
