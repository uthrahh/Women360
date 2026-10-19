import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "@/app";
import { goalProgressPct } from "@/modules/goals/progress";

const app = createApp();

async function signUp(label: string) {
  const res = await request(app).post("/api/v1/auth/register").send({
    name: "Goal Tester",
    email: `${label}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`,
    password: "a-long-enough-password",
  });
  expect(res.status).toBe(201);
  return res.body.data.accessToken as string;
}
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const make = (token: string, body: object) => request(app).post("/api/v1/goals").set(auth(token)).send(body);

const base = { kind: "TOTAL" as const, completed: false, currentValue: 0, targetValue: 100, startValue: null };

describe("goalProgressPct", () => {
  it("TOTAL: how much of the target is done, clamped", () => {
    expect(goalProgressPct({ ...base, currentValue: 7, targetValue: 12 })).toBe(58);
    expect(goalProgressPct({ ...base, currentValue: 15, targetValue: 12 })).toBe(100);
    expect(goalProgressPct({ ...base, currentValue: 0, targetValue: 0 })).toBe(0);
  });

  it("REACH going down: measured from where it started", () => {
    const g = { ...base, kind: "REACH" as const, startValue: 72, targetValue: 67 };
    expect(goalProgressPct({ ...g, currentValue: 72 })).toBe(0);
    expect(goalProgressPct({ ...g, currentValue: 69.5 })).toBe(50);
    expect(goalProgressPct({ ...g, currentValue: 67 })).toBe(100);
    expect(goalProgressPct({ ...g, currentValue: 65 })).toBe(100);
    expect(goalProgressPct({ ...g, currentValue: 74 })).toBe(0);
  });

  it("REACH going up works the same way", () => {
    const g = { ...base, kind: "REACH" as const, startValue: 50, targetValue: 60 };
    expect(goalProgressPct({ ...g, currentValue: 55 })).toBe(50);
  });

  it("ONE_OFF: done or not", () => {
    expect(goalProgressPct({ ...base, kind: "ONE_OFF", completed: false })).toBe(0);
    expect(goalProgressPct({ ...base, kind: "ONE_OFF", completed: true })).toBe(100);
  });
});

describe("goal kinds over the API", () => {
  it("TOTAL needs a target above zero; unit and category are optional", async () => {
    const token = await signUp("gk-total");
    expect((await make(token, { title: "Read 12 books", kind: "TOTAL" })).status).toBe(422);
    const ok = await make(token, { title: "Read 12 books", kind: "TOTAL", targetValue: 12, unit: "books", category: "LEARNING" });
    expect(ok.status).toBe(201);
    expect(ok.body.data).toMatchObject({ kind: "TOTAL", currentValue: 0, targetValue: 12, category: "LEARNING" });
  });

  it("a goal with no kind is a TOTAL, as every goal made before kinds existed was", async () => {
    const token = await signUp("gk-legacy");
    const res = await make(token, { title: "Walk 8000 steps", category: "ACTIVITY", targetValue: 8000, unit: "steps" });
    expect(res.status).toBe(201);
    expect(res.body.data.kind).toBe("TOTAL");
  });

  it("REACH needs where you are and a different target, and remembers the start", async () => {
    const token = await signUp("gk-reach");
    expect((await make(token, { title: "Lose weight", kind: "REACH", targetValue: 67 })).status).toBe(422);
    expect((await make(token, { title: "Lose weight", kind: "REACH", currentValue: 72, targetValue: 72 })).status).toBe(422);
    const ok = await make(token, { title: "Lose weight", kind: "REACH", currentValue: 72, targetValue: 67, unit: "kg", dueDate: "2027-03-01" });
    expect(ok.status).toBe(201);
    expect(ok.body.data).toMatchObject({ kind: "REACH", startValue: 72, currentValue: 72, targetValue: 67, category: "BODY" });
    expect(ok.body.data.dueDate.slice(0, 10)).toBe("2027-03-01");
    const moved = await request(app).patch(`/api/v1/goals/${ok.body.data.id}`).set(auth(token)).send({ currentValue: 70 });
    expect(moved.body.data).toMatchObject({ currentValue: 70, startValue: 72 });
  });

  it("ONE_OFF needs only a title, and ticking it done moves its counter too", async () => {
    const token = await signUp("gk-oneoff");
    const ok = await make(token, { title: "Book a health check-up", kind: "ONE_OFF", category: "PREVENTIVE", dueDate: "2027-01-15" });
    expect(ok.status).toBe(201);
    expect(ok.body.data).toMatchObject({ kind: "ONE_OFF", currentValue: 0, targetValue: 1, completed: false });
    const done = await request(app).patch(`/api/v1/goals/${ok.body.data.id}`).set(auth(token)).send({ completed: true });
    expect(done.body.data).toMatchObject({ completed: true, currentValue: 1 });
    const undone = await request(app).patch(`/api/v1/goals/${ok.body.data.id}`).set(auth(token)).send({ completed: false });
    expect(undone.body.data.currentValue).toBe(0);
  });

  it("a due date can be changed and cleared", async () => {
    const token = await signUp("gk-due");
    const id = (await make(token, { title: "Read", kind: "TOTAL", targetValue: 5, dueDate: "2027-06-01" })).body.data.id;
    const changed = await request(app).patch(`/api/v1/goals/${id}`).set(auth(token)).send({ dueDate: "2027-07-01" });
    expect(changed.body.data.dueDate.slice(0, 10)).toBe("2027-07-01");
    const cleared = await request(app).patch(`/api/v1/goals/${id}`).set(auth(token)).send({ dueDate: null });
    expect(cleared.body.data.dueDate).toBeNull();
    expect((await request(app).patch(`/api/v1/goals/${id}`).set(auth(token)).send({ dueDate: "soon" })).status).toBe(422);
  });
});
