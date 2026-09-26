import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "@/app";

const app = createApp();
const DAY_MS = 86_400_000;

function daysAgo(n: number): string {
  return new Date(Date.now() - n * DAY_MS).toISOString().slice(0, 10);
}

async function registerUser(): Promise<string> {
  const res = await request(app)
    .post("/api/v1/auth/register")
    .send({ name: "Insights Tester", email: `insights.${Date.now()}.${Math.random()}@example.com`, password: "a-long-enough-password" });
  return res.body.data.accessToken as string;
}

async function logSleep(token: string, date: string, durationHours: number) {
  await request(app)
    .put(`/api/v1/sleep/entries/${date}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ date, durationHours, quality: 3, bedtime: "10:30 PM", wakeTime: "6:30 AM" });
}

async function logStress(token: string, date: string, stress: number) {
  await request(app)
    .put(`/api/v1/wellbeing/entries/${date}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ date, mood: 2, stress, energy: 2 });
}

describe("cross-domain 'explain this' factors — cycle delay", () => {
  it("returns only the pregnancy factor and flags insufficient data for a brand-new user", async () => {
    const token = await registerUser();
    const res = await request(app).get("/api/v1/insights/cycle-delay").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.insufficientData).toBe(true);
    expect(res.body.data.factors).toHaveLength(1);
    expect(res.body.data.factors[0].label).toBe("Pregnancy");
    expect(res.body.data.disclaimer).toMatch(/not a diagnosis/i);
  });

  it("never fires a sleep/stress factor when recent values match the user's own baseline", async () => {
    const token = await registerUser();
    for (let i = 0; i < 20; i++) {
      await logSleep(token, daysAgo(i), 8);
      await logStress(token, daysAgo(i), 2);
    }
    const res = await request(app).get("/api/v1/insights/cycle-delay").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    const labels = res.body.data.factors.map((f: { label: string }) => f.label);
    expect(labels).not.toContain("Less sleep than usual");
    expect(labels).not.toContain("Higher stress than usual");
  });

  it("flags a genuine sleep-duration drop from the user's own recent baseline", async () => {
    const token = await registerUser();
    // 15 baseline nights at 8h, then the most recent 10 nights at 6h.
    for (let i = 15; i < 29; i++) await logSleep(token, daysAgo(i), 8);
    for (let i = 0; i < 10; i++) await logSleep(token, daysAgo(i), 6);

    const res = await request(app).get("/api/v1/insights/cycle-delay").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    const labels = res.body.data.factors.map((f: { label: string }) => f.label);
    expect(labels).toContain("Less sleep than usual");
  });

  it("suppresses the pregnancy factor for menopausal and postmenopausal users", async () => {
    for (const lifeStage of ["MENOPAUSE", "POSTMENOPAUSE"]) {
      const token = await registerUser();
      await request(app).patch("/api/v1/users/me").set("Authorization", `Bearer ${token}`).send({ lifeStage });
      const res = await request(app).get("/api/v1/insights/cycle-delay").set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      const labels = res.body.data.factors.map((f: { label: string }) => f.label);
      expect(labels).not.toContain("Pregnancy");
    }
  });
});

describe("cross-domain 'explain this' factors — low mood", () => {
  it("flags a genuine sleep-duration drop the night before, not just cycle phase", async () => {
    const token = await registerUser();
    // 10 baseline nights at 8h (ending 2 days ago), then a short night yesterday.
    for (let i = 2; i < 12; i++) await logSleep(token, daysAgo(i), 8);
    await logSleep(token, daysAgo(1), 4);

    const res = await request(app).get("/api/v1/insights/low-mood").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    const labels = res.body.data.factors.map((f: { label: string }) => f.label);
    expect(labels).toContain("Less sleep last night");
  });

  it("reports insufficient data for a brand-new user instead of guessing", async () => {
    const token = await registerUser();
    const res = await request(app).get("/api/v1/insights/low-mood").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.insufficientData).toBe(true);
    expect(res.body.data.factors).toHaveLength(0);
  });
});
