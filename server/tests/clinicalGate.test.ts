import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "@/app";

const app = createApp();
const DAY_MS = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY_MS).toISOString().slice(0, 10);
const today = daysAgo(0);
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

let ip = 220;
async function signUp() {
  const res = await request(app).post("/api/v1/auth/register").set("X-Forwarded-For", `198.18.0.${ip++}`).send({
    name: "Gate Tester", email: `gate.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`, password: "a-long-enough-password",
  });
  return res.body.data.accessToken as string;
}

afterEach(() => {
  process.env.CLINICAL_CONTENT = "true";
});

describe("the switch for features that need clinical review", () => {
  it("tells the web app whether they are on, without signing in", async () => {
    process.env.CLINICAL_CONTENT = "false";
    expect((await request(app).get("/api/v1/config")).body.data.clinicalContent).toBe(false);
    process.env.CLINICAL_CONTENT = "true";
    expect((await request(app).get("/api/v1/config")).body.data.clinicalContent).toBe(true);
  });

  it("is off unless it is exactly 'true'", async () => {
    for (const value of [undefined, "", "1", "yes", "TRUE"]) {
      if (value === undefined) delete process.env.CLINICAL_CONTENT;
      else process.env.CLINICAL_CONTENT = value;
      expect((await request(app).get("/api/v1/config")).body.data.clinicalContent).toBe(false);
    }
  });

  it("makes the server refuse every one of those routes when off", async () => {
    const token = await signUp();
    process.env.CLINICAL_CONTENT = "false";
    const gets = ["/conditions", `/conditions/signals?today=${today}`, "/screening", "/learn", "/insights/cycle-delay", "/insights/low-mood", `/activity/plan/options?today=${today}`, `/activity/plan/active?today=${today}`];
    for (const path of gets) {
      const res = await request(app).get(`/api/v1${path}`).set(auth(token));
      expect(res.status, path).toBe(404);
    }
    const plan = await request(app).post("/api/v1/activity/plan").set(auth(token)).send({ goal: "HEALTH", weeks: 8, days: [1, 3], sessionMinutes: 30, startDate: today, activityCodes: [] });
    expect(plan.status).toBe(404);
    expect((await request(app).put("/api/v1/conditions").set(auth(token)).send({ conditions: ["PCOS"] })).status).toBe(404);
  });

  it("leaves ordinary tracking alone when off", async () => {
    const token = await signUp();
    process.env.CLINICAL_CONTENT = "false";
    for (const path of ["/activity/summary", "/sleep/summary", "/nutrition/today", `/cycle/summary?today=${today}`, "/habits", "/notifications"]) {
      expect((await request(app).get(`/api/v1${path}`).set(auth(token))).status, path).toBe(200);
    }
  });

  it("keeps the cycle note to a plain statement when off, and unchanged when on", async () => {
    const token = await signUp();
    for (const d of [216, 196, 146, 118, 58]) {
      await request(app).put(`/api/v1/cycle/entries/${daysAgo(d)}`).set(auth(token)).send({ isPeriod: true, flow: "MEDIUM" });
    }
    const note = async () => (await request(app).get(`/api/v1/cycle/summary?today=${today}`).set(auth(token))).body.data.irregularityNote as string;
    process.env.CLINICAL_CONTENT = "false";
    const off = await note();
    expect(off).toMatch(/varied a lot/);
    expect(off).not.toMatch(/PCOS|thyroid|clinician/);
    process.env.CLINICAL_CONTENT = "true";
    expect(await note()).toMatch(/PCOS/);
  });
});
