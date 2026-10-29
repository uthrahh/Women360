import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "@/app";
import { clockMinutes, sleepDurationHours } from "@/modules/sleep/duration";
import { addDays } from "@/modules/activity/plan/planner";

const app = createApp();
const today = new Date().toISOString().slice(0, 10);
const yesterday = addDays(today, -1);
let token: string;
const auth = () => ({ Authorization: `Bearer ${token}` });
const put = (date: string, body: object) =>
  request(app).put(`/api/v1/sleep/entries/${date}`).set(auth()).send({ date, quality: 3, ...body });

beforeAll(async () => {
  const res = await request(app).post("/api/v1/auth/register").send({ name: "Sleep Span", email: `sleepspan.${Date.now()}@example.com`, password: "a-long-enough-password" });
  token = res.body.data.accessToken;
});

describe("reading a clock time", () => {
  it("reads 12-hour and 24-hour times, and refuses nonsense", () => {
    expect(clockMinutes("11:00 PM")).toBe(23 * 60);
    expect(clockMinutes("12:30 AM")).toBe(30);
    expect(clockMinutes("12:30 PM")).toBe(12 * 60 + 30);
    expect(clockMinutes("7:05 am")).toBe(7 * 60 + 5);
    expect(clockMinutes("23:15")).toBe(23 * 60 + 15);
    for (const bad of ["", "25:00", "7:99", "13:00 PM", "0:30 AM", "soon"]) expect(clockMinutes(bad)).toBeNull();
  });
});

describe("how long she slept, from the two days and times", () => {
  it("counts a night that crosses midnight, a night that starts after midnight, and a nap", () => {
    expect(sleepDurationHours("2026-10-28", "11:00 PM", "2026-10-29", "7:00 AM")).toBe(8);
    expect(sleepDurationHours("2026-10-29", "1:00 AM", "2026-10-29", "8:30 AM")).toBe(7.5);
    expect(sleepDurationHours("2026-10-29", "1:00 PM", "2026-10-29", "2:30 PM")).toBe(1.5);
  });
  it("refuses waking before bed, no time at all, and more than a day", () => {
    expect(sleepDurationHours("2026-10-29", "11:00 PM", "2026-10-29", "7:00 AM")).toBeNull();
    expect(sleepDurationHours("2026-10-28", "11:00 PM", "2026-10-28", "11:00 PM")).toBeNull();
    expect(sleepDurationHours("2026-10-27", "11:00 PM", "2026-10-29", "7:00 AM")).toBeNull();
    expect(sleepDurationHours("2026-10-28", "11:00 PM", "2026-10-29", "11:00 PM")).toBe(24);
  });
});

describe("logging sleep with the day she went to bed", () => {
  it("stores both days and works out the duration itself, ignoring the one the client sends", async () => {
    const res = await put(today, { bedDate: yesterday, bedtime: "11:00 PM", wakeTime: "7:00 AM", durationHours: 3 });
    expect(res.status).toBe(200);
    expect(res.body.data.durationHours).toBe(8);
    expect(res.body.data.bedDate.slice(0, 10)).toBe(yesterday);
    expect(res.body.data.date.slice(0, 10)).toBe(today);
  });

  it("refuses waking before going to bed, and a bed day after the wake day", async () => {
    const before = await put(today, { bedDate: today, bedtime: "11:00 PM", wakeTime: "7:00 AM", durationHours: 8 });
    expect(before.status).toBe(400);
    expect(before.body.error.message).toMatch(/after bedtime/);
    const after = await put(today, { bedDate: addDays(today, 1), bedtime: "11:00 PM", wakeTime: "7:00 AM", durationHours: 8 });
    expect(after.status).toBe(400);
  });

  it("refuses a span of more than a day", async () => {
    const res = await put(today, { bedDate: addDays(today, -2), bedtime: "11:00 PM", wakeTime: "7:00 AM", durationHours: 8 });
    expect(res.status).toBe(400);
  });

  it("still accepts an older client that sends no bed day, using the duration it sent", async () => {
    const res = await put(yesterday, { bedtime: "10:30 PM", wakeTime: "6:30 AM", durationHours: 8 });
    expect(res.status).toBe(200);
    expect(res.body.data.durationHours).toBe(8);
    expect(res.body.data.bedDate).toBeNull();
  });

  it("returns the bed day with each night in her history", async () => {
    await put(today, { bedDate: yesterday, bedtime: "11:00 PM", wakeTime: "7:00 AM", durationHours: 8 });
    const summary = await request(app).get("/api/v1/sleep/summary").set(auth());
    const night = summary.body.data.history.find((e: { date: string }) => e.date.slice(0, 10) === today);
    expect(night.bedDate.slice(0, 10)).toBe(yesterday);
  });
});
