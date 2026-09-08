import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "@/app";

const app = createApp();
let tokenA: string;
let tokenB: string;
const today = new Date().toISOString().slice(0, 10);

beforeAll(async () => {
  const resA = await request(app).post("/api/v1/auth/register").send({
    name: "Report Tester A",
    email: `report-a.${Date.now()}@example.com`,
    password: "a-long-enough-password",
  });
  tokenA = resA.body.data.accessToken;

  const resB = await request(app).post("/api/v1/auth/register").send({
    name: "Report Tester B",
    email: `report-b.${Date.now()}@example.com`,
    password: "a-long-enough-password",
  });
  tokenB = resB.body.data.accessToken;

  // Give user A some real data to summarize.
  await request(app).post("/api/v1/nutrition/meals").set("Authorization", `Bearer ${tokenA}`).send({
    date: today, time: "8:00 AM", name: "Oatmeal", servings: "1 bowl", calories: 350, proteinG: 12, fibreG: 5,
  });
  await request(app).put(`/api/v1/sleep/entries/${today}`).set("Authorization", `Bearer ${tokenA}`).send({
    date: today, durationHours: 7.5, quality: 4, bedtime: "11:00 PM", wakeTime: "6:30 AM",
  });
  await request(app).post("/api/v1/goals").set("Authorization", `Bearer ${tokenA}`).send({
    title: "Drink more water", category: "HYDRATION", currentValue: 4, targetValue: 8, unit: "glasses",
  });
});

describe("report generation", () => {
  it("includes real nutrition and sleep data from the same records the app itself shows", async () => {
    const gen = await request(app).post("/api/v1/reports").set("Authorization", `Bearer ${tokenA}`).send({
      title: "Health Report", rangeLabel: "Last 30 days", rangeDays: 30,
    });
    expect(gen.status).toBe(201);

    const full = await request(app).get(`/api/v1/reports/${gen.body.data.id}`).set("Authorization", `Bearer ${tokenA}`);
    expect(full.status).toBe(200);
    const snap = full.body.data.dataSnapshot;

    expect(snap.nutrition.daysLogged).toBe(1);
    expect(snap.nutrition.avgCaloriesPerLoggedDay).toBe(350);
    expect(snap.nutrition.avgFibreGPerLoggedDay).toBe(5);
    expect(snap.sleep.entryCount).toBe(1);
    expect(snap.sleep.avgDurationHours).toBe(7.5);
    // Sleep quality in the report must be the 1-5 scale, never a percentage.
    expect(snap.sleep.avgQuality).toBe(4);
    expect(snap.goals.active).toHaveLength(1);
    expect(snap.goals.active[0].progressPct).toBe(50);
  });

  it("reports no data honestly instead of fabricating zeros for a user with nothing logged", async () => {
    const gen = await request(app).post("/api/v1/reports").set("Authorization", `Bearer ${tokenB}`).send({
      title: "Health Report", rangeLabel: "Last 7 days", rangeDays: 7,
    });
    const full = await request(app).get(`/api/v1/reports/${gen.body.data.id}`).set("Authorization", `Bearer ${tokenB}`);
    const snap = full.body.data.dataSnapshot;

    expect(snap.nutrition.daysLogged).toBe(0);
    expect(snap.nutrition.avgCaloriesPerLoggedDay).toBeNull();
    expect(snap.sleep.entryCount).toBe(0);
    expect(snap.cycle.hasData).toBe(false);
  });

  it("does not let one user read another user's report", async () => {
    const gen = await request(app).post("/api/v1/reports").set("Authorization", `Bearer ${tokenA}`).send({
      title: "Health Report", rangeLabel: "Last 30 days", rangeDays: 30,
    });
    const stolen = await request(app).get(`/api/v1/reports/${gen.body.data.id}`).set("Authorization", `Bearer ${tokenB}`);
    expect(stolen.status).toBe(403);
  });
});
