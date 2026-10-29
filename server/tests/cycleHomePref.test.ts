import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "@/app";

const app = createApp();
let token: string;
const auth = () => ({ Authorization: `Bearer ${token}` });
const put = (body: object) => request(app).put("/api/v1/cycle/profile").set(auth()).send(body);
const get = () => request(app).get("/api/v1/cycle/profile").set(auth());

beforeAll(async () => {
  const res = await request(app).post("/api/v1/auth/register").send({ name: "Home Pref", email: `homepref.${Date.now()}@example.com`, password: "a-long-enough-password" });
  token = res.body.data.accessToken;
});

describe("showing ovulation on the home screen", () => {
  it("is off until she turns it on", async () => {
    expect((await get()).body.data.showOvulationOnHome).toBe(false);
  });

  it("saves when she turns it on and off", async () => {
    expect((await put({ averageCycleLength: 30, averagePeriodLength: 5, showOvulationOnHome: true })).status).toBe(200);
    expect((await get()).body.data.showOvulationOnHome).toBe(true);
    await put({ averageCycleLength: 30, averagePeriodLength: 5, showOvulationOnHome: false });
    expect((await get()).body.data.showOvulationOnHome).toBe(false);
  });

  it("is left alone when a save doesn't mention it (an older client, or onboarding)", async () => {
    await put({ averageCycleLength: 30, averagePeriodLength: 5, showOvulationOnHome: true });
    expect((await put({ averageCycleLength: 27, averagePeriodLength: 4 })).status).toBe(200);
    const profile = (await get()).body.data;
    expect(profile.showOvulationOnHome).toBe(true);
    expect(profile.averageCycleLength).toBe(27);
  });

  it("rejects a value that isn't true or false", async () => {
    expect((await put({ averageCycleLength: 28, averagePeriodLength: 5, showOvulationOnHome: "yes" })).status).toBe(422);
  });
});
