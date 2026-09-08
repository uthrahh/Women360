import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "@/app";

const app = createApp();
let token: string;
const today = new Date().toISOString().slice(0, 10);

beforeAll(async () => {
  const res = await request(app).post("/api/v1/auth/register").send({
    name: "Sleep Tester",
    email: `sleep.${Date.now()}@example.com`,
    password: "a-long-enough-password",
  });
  token = res.body.data.accessToken;
});


describe("sleep entries", () => {
  it("stores and returns quality on the 1-5 scale", async () => {
    const res = await request(app).put(`/api/v1/sleep/entries/${today}`).set("Authorization", `Bearer ${token}`).send({
      date: today, durationHours: 8, quality: 5, bedtime: "10:30 PM", wakeTime: "6:30 AM",
    });
    expect(res.status).toBe(200);
    expect(res.body.data.quality).toBe(5);

    const summary = await request(app).get("/api/v1/sleep/summary").set("Authorization", `Bearer ${token}`);
    expect(summary.body.data.quality).toBe(5);
    expect(summary.body.data.history[0].quality).toBe(5);
  });

  it("rejects a quality value outside 1-5", async () => {
    const tooHigh = await request(app).put(`/api/v1/sleep/entries/${today}`).set("Authorization", `Bearer ${token}`).send({
      date: today, durationHours: 8, quality: 100, bedtime: "10:30 PM", wakeTime: "6:30 AM",
    });
    expect(tooHigh.status).toBe(422);

    const tooLow = await request(app).put(`/api/v1/sleep/entries/${today}`).set("Authorization", `Bearer ${token}`).send({
      date: today, durationHours: 8, quality: 0, bedtime: "10:30 PM", wakeTime: "6:30 AM",
    });
    expect(tooLow.status).toBe(422);
  });

  it("deletes an entry and it no longer appears in history", async () => {
    const del = await request(app).delete(`/api/v1/sleep/entries/${today}`).set("Authorization", `Bearer ${token}`);
    expect(del.status).toBe(204);

    const summary = await request(app).get("/api/v1/sleep/summary").set("Authorization", `Bearer ${token}`);
    expect(summary.body.data.history.find((e: { date: string }) => e.date.slice(0, 10) === today)).toBeUndefined();
  });
});
