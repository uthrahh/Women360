import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "@/app";
import { computeStreak, isValidIsoDay } from "@/modules/goals/streak";

const app = createApp();
const PASSWORD = "a-long-enough-password";

function isoDaysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
}

describe("computeStreak", () => {
  it("counts consecutive days ending today", () => {
    expect(computeStreak(["2026-03-08", "2026-03-09", "2026-03-10"], "2026-03-10")).toEqual({ streak: 3, checkedInToday: true });
  });

  it("keeps the streak alive through today when yesterday was checked in", () => {
    expect(computeStreak(["2026-03-08", "2026-03-09"], "2026-03-10")).toEqual({ streak: 2, checkedInToday: false });
  });

  it("is 0 after a whole missed day", () => {
    expect(computeStreak(["2026-03-07", "2026-03-08"], "2026-03-10")).toEqual({ streak: 0, checkedInToday: false });
  });

  it("stops at the first gap and ignores older runs", () => {
    expect(computeStreak(["2026-03-01", "2026-03-02", "2026-03-09", "2026-03-10"], "2026-03-10").streak).toBe(2);
  });

  it("counts across month and year boundaries", () => {
    expect(computeStreak(["2025-12-30", "2025-12-31", "2026-01-01"], "2026-01-01").streak).toBe(3);
  });

  it("ignores duplicate days", () => {
    expect(computeStreak(["2026-03-10", "2026-03-10"], "2026-03-10").streak).toBe(1);
  });

  it("is 0 with no check-ins", () => {
    expect(computeStreak([], "2026-03-10")).toEqual({ streak: 0, checkedInToday: false });
  });
});

describe("isValidIsoDay", () => {
  it("accepts real dates only", () => {
    expect(isValidIsoDay("2026-02-28")).toBe(true);
    expect(isValidIsoDay("2026-02-30")).toBe(false);
    expect(isValidIsoDay("2026-2-3")).toBe(false);
    expect(isValidIsoDay("not-a-date")).toBe(false);
  });
});

describe("goal check-ins", () => {
  async function signUp(label: string) {
    const res = await request(app).post("/api/v1/auth/register").send({
      name: "Streak Tester",
      email: `${label}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`,
      password: PASSWORD,
    });
    expect(res.status).toBe(201);
    return res.body.data.accessToken as string;
  }
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function newGoal(token: string) {
    const res = await request(app).post("/api/v1/goals").set(auth(token)).send({
      title: "Drink water", category: "HYDRATION", targetValue: 8, unit: "glasses",
    });
    expect(res.status).toBe(201);
    return res.body.data.id as string;
  }

  it("checks in, builds a streak, and undoes a check-in", async () => {
    const token = await signUp("streak");
    const id = await newGoal(token);

    for (const n of [2, 1, 0]) {
      const res = await request(app).post(`/api/v1/goals/${id}/check-ins`).set(auth(token)).send({ date: isoDaysAgo(n) });
      expect(res.status).toBe(200);
    }
    const list = await request(app).get(`/api/v1/goals?today=${isoDaysAgo(0)}`).set(auth(token));
    const goal = list.body.data.find((g: { id: string }) => g.id === id);
    expect(goal.streak).toBe(3);
    expect(goal.checkedInToday).toBe(true);

    const undone = await request(app).delete(`/api/v1/goals/${id}/check-ins/${isoDaysAgo(0)}`).set(auth(token));
    expect(undone.status).toBe(200);
    expect(undone.body.data.checkedInToday).toBe(false);
    expect(undone.body.data.streak).toBe(2);
  });

  it("is idempotent: checking in twice for a day counts once", async () => {
    const token = await signUp("idem");
    const id = await newGoal(token);
    const body = { date: isoDaysAgo(0) };
    await request(app).post(`/api/v1/goals/${id}/check-ins`).set(auth(token)).send(body);
    const again = await request(app).post(`/api/v1/goals/${id}/check-ins`).set(auth(token)).send(body);
    expect(again.status).toBe(200);
    expect(again.body.data.streak).toBe(1);
  });

  it("rejects future and far-past days and malformed dates", async () => {
    const token = await signUp("range");
    const id = await newGoal(token);
    const post = (date: string) => request(app).post(`/api/v1/goals/${id}/check-ins`).set(auth(token)).send({ date });
    expect((await post(isoDaysAgo(-5))).status).toBe(400);
    expect((await post(isoDaysAgo(30))).status).toBe(400);
    expect((await post("tomorrow")).status).toBe(422);
  });

  it("won't let someone check in to another person's goal", async () => {
    const owner = await signUp("owner");
    const other = await signUp("other");
    const id = await newGoal(owner);
    const res = await request(app).post(`/api/v1/goals/${id}/check-ins`).set(auth(other)).send({ date: isoDaysAgo(0) });
    expect(res.status).toBe(403);
  });

  it("deleting a goal removes its check-ins", async () => {
    const token = await signUp("cascade");
    const id = await newGoal(token);
    await request(app).post(`/api/v1/goals/${id}/check-ins`).set(auth(token)).send({ date: isoDaysAgo(0) });
    expect((await request(app).delete(`/api/v1/goals/${id}`).set(auth(token))).status).toBe(204);
    const list = await request(app).get("/api/v1/goals").set(auth(token));
    expect(list.body.data.find((g: { id: string }) => g.id === id)).toBeUndefined();
  });
});
