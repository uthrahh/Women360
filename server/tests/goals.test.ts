import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "@/app";

const app = createApp();
let tokenA: string;
let tokenB: string;

beforeAll(async () => {
  const resA = await request(app).post("/api/v1/auth/register").send({
    name: "Goal Tester A",
    email: `goal-a.${Date.now()}@example.com`,
    password: "a-long-enough-password",
  });
  tokenA = resA.body.data.accessToken;

  const resB = await request(app).post("/api/v1/auth/register").send({
    name: "Goal Tester B",
    email: `goal-b.${Date.now()}@example.com`,
    password: "a-long-enough-password",
  });
  tokenB = resB.body.data.accessToken;
});

describe("goals", () => {
  it("persists a created goal with real current/target values, not a stored percentage", async () => {
    const create = await request(app).post("/api/v1/goals").set("Authorization", `Bearer ${tokenA}`).send({
      title: "Walk 8000 steps", category: "ACTIVITY", currentValue: 4000, targetValue: 8000, unit: "steps",
    });
    expect(create.status).toBe(201);
    expect(create.body.data.currentValue).toBe(4000);
    expect(create.body.data.targetValue).toBe(8000);
    expect(create.body.data.completed).toBe(false);

    const list = await request(app).get("/api/v1/goals").set("Authorization", `Bearer ${tokenA}`);
    expect(list.body.data.find((g: { id: string }) => g.id === create.body.data.id)).toBeTruthy();
  });

  it("updates progress by changing currentValue, and progress is always current/target", async () => {
    const create = await request(app).post("/api/v1/goals").set("Authorization", `Bearer ${tokenA}`).send({
      title: "Two strength sessions", category: "STRENGTH", currentValue: 1, targetValue: 2, unit: "sessions",
    });
    const updated = await request(app).patch(`/api/v1/goals/${create.body.data.id}`).set("Authorization", `Bearer ${tokenA}`).send({
      currentValue: 2,
    });
    expect(updated.status).toBe(200);
    expect(updated.body.data.currentValue).toBe(2);
    expect(updated.body.data.targetValue).toBe(2);
  });

  it("marks a goal complete and it persists across a fresh read", async () => {
    const create = await request(app).post("/api/v1/goals").set("Authorization", `Bearer ${tokenA}`).send({
      title: "Sleep 7 hours", category: "SLEEP", currentValue: 7, targetValue: 7, unit: "hours",
    });
    const completed = await request(app).patch(`/api/v1/goals/${create.body.data.id}`).set("Authorization", `Bearer ${tokenA}`).send({
      completed: true,
    });
    expect(completed.body.data.completed).toBe(true);

    const reread = await request(app).get("/api/v1/goals").set("Authorization", `Bearer ${tokenA}`);
    const found = reread.body.data.find((g: { id: string }) => g.id === create.body.data.id);
    expect(found.completed).toBe(true);
  });

  it("deletes a goal and it no longer appears", async () => {
    const create = await request(app).post("/api/v1/goals").set("Authorization", `Bearer ${tokenA}`).send({
      title: "Temp goal", category: "MOBILITY", currentValue: 0, targetValue: 10, unit: "min",
    });
    const del = await request(app).delete(`/api/v1/goals/${create.body.data.id}`).set("Authorization", `Bearer ${tokenA}`);
    expect(del.status).toBe(204);

    const reread = await request(app).get("/api/v1/goals").set("Authorization", `Bearer ${tokenA}`);
    expect(reread.body.data.find((g: { id: string }) => g.id === create.body.data.id)).toBeUndefined();
  });

  it("does not let user B update or delete user A's goal", async () => {
    const create = await request(app).post("/api/v1/goals").set("Authorization", `Bearer ${tokenA}`).send({
      title: "User A's private goal", category: "NUTRITION", currentValue: 0, targetValue: 5, unit: "servings",
    });
    const patchAttempt = await request(app).patch(`/api/v1/goals/${create.body.data.id}`).set("Authorization", `Bearer ${tokenB}`).send({
      completed: true,
    });
    expect(patchAttempt.status).toBe(403);

    const deleteAttempt = await request(app).delete(`/api/v1/goals/${create.body.data.id}`).set("Authorization", `Bearer ${tokenB}`);
    expect(deleteAttempt.status).toBe(403);

    const listB = await request(app).get("/api/v1/goals").set("Authorization", `Bearer ${tokenB}`);
    expect(listB.body.data).toEqual([]);
  });
});
