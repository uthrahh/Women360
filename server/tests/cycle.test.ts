import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "@/app";

const app = createApp();
const DAY_MS = 86_400_000;

function daysAgo(n: number): string {
  return new Date(Date.now() - n * DAY_MS).toISOString().slice(0, 10);
}

async function registerAndLogStarts(startsDaysAgo: number[]): Promise<string> {
  const res = await request(app)
    .post("/api/v1/auth/register")
    .send({ name: "Cycle Tester", email: `cycle.${Date.now()}.${Math.random()}@example.com`, password: "a-long-enough-password" });
  const token = res.body.data.accessToken as string;
  for (const days of startsDaysAgo) {
    await request(app)
      .put(`/api/v1/cycle/entries/${daysAgo(days)}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ isPeriod: true, flow: "MEDIUM" });
  }
  return token;
}

describe("cycle prediction — median/MAD over the user's own history", () => {
  it("gives a high-confidence, narrow prediction for consistent 28-day cycles", async () => {
    // 6 period starts, each exactly 28 days apart, most recent 2 days ago.
    const starts = [2, 30, 58, 86, 114, 142];
    const token = await registerAndLogStarts(starts);

    const res = await request(app).get("/api/v1/cycle/summary").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.lastCycleLengths).toEqual([28, 28, 28, 28, 28]);
    expect(res.body.data.cycleLength).toBe(28);
    expect(res.body.data.confidence).toBe("high");
    expect(res.body.data.irregularityNote).toBeNull();
    // Never a single false-precise date — always a range.
    expect(res.body.data.nextPeriodRangeStart).not.toBeNull();
    expect(res.body.data.nextPeriodRangeEnd).not.toBeNull();
    expect(res.body.data.nextPeriodRangeStart).not.toBe(res.body.data.nextPeriodRangeEnd);
  });

  it("flags low confidence and an irregularity note for highly variable cycles", async () => {
    // Gaps of 21, 35, 18, 40, 25 days — a coefficient of variation well over 20%.
    const gaps = [21, 35, 18, 40, 25];
    const startsDaysAgo: number[] = [3];
    for (let i = gaps.length - 1; i >= 0; i--) {
      startsDaysAgo.push(startsDaysAgo[startsDaysAgo.length - 1] + gaps[i]);
    }
    const token = await registerAndLogStarts(startsDaysAgo);

    const res = await request(app).get("/api/v1/cycle/summary").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.confidence).toBe("low");
    expect(res.body.data.irregularityNote).toBeTruthy();
  });

  it("marks confidence low and explains why for a brand-new user with under 2 logged cycles", async () => {
    const token = await registerAndLogStarts([2]);

    const res = await request(app).get("/api/v1/cycle/summary").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.confidence).toBe("low");
    expect(res.body.data.irregularityNote).toMatch(/not enough logged cycles/i);
  });

  it("forces low confidence for a perimenopausal user even with consistent cycles", async () => {
    const token = await registerAndLogStarts([2, 30, 58, 86, 114, 142]);
    await request(app).patch("/api/v1/users/me").set("Authorization", `Bearer ${token}`).send({ lifeStage: "PERIMENOPAUSE" });

    const res = await request(app).get("/api/v1/cycle/summary").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.confidence).toBe("low");
    expect(res.body.data.irregularityNote).toMatch(/perimenopause/i);
  });
});
