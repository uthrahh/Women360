import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "@/app";
import { prisma } from "@/lib/prisma";

const app = createApp();
const PASSWORD = "a-long-enough-password";
const dayOffset = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

let ip = 120;
async function signUp(label: string) {
  const res = await request(app).post("/api/v1/auth/register").set("X-Forwarded-For", `203.0.113.${ip++}`).send({
    name: "Steps Tester",
    email: `${label}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`,
    password: PASSWORD,
    dateOfBirth: "1990-05-15",
  });
  expect(res.status).toBe(201);
  return { token: res.body.data.accessToken as string, id: res.body.data.user.id as string };
}
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const sync = (t: string, body: object) => request(app).post("/api/v1/activity/steps/sync").set(auth(t)).send(body);
const rows = (id: string) => prisma.stepsLog.findMany({ where: { userId: id }, orderBy: { date: "asc" } });

describe("steps filled in from a phone or a file", () => {
  it("saves days, marks where they came from, and says when", async () => {
    const { token, id } = await signUp("save");
    const res = await sync(token, { source: "DEVICE", days: [{ date: dayOffset(-2), steps: 4200 }, { date: dayOffset(-1), steps: 8100 }] });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ saved: 2, keptOwn: 0 });
    const stored = await rows(id);
    expect(stored.map((r) => [r.steps, r.source])).toEqual([[4200, "DEVICE"], [8100, "DEVICE"]]);
    expect(stored.every((r) => r.syncedAt !== null)).toBe(true);
    const status = await request(app).get("/api/v1/activity/steps/sync").set(auth(token));
    expect(status.body.data.source).toBe("DEVICE");
    expect(status.body.data.lastSyncedAt).not.toBeNull();
  });

  it("never overwrites a day she typed herself, and says how many it kept", async () => {
    const { token, id } = await signUp("manual");
    const today = dayOffset(0);
    await request(app).post("/api/v1/activity/steps").set(auth(token)).send({ date: today, steps: 3000 });
    const res = await sync(token, { source: "DEVICE", days: [{ date: today, steps: 9999 }, { date: dayOffset(-1), steps: 5000 }] });
    expect(res.body.data).toEqual({ saved: 1, keptOwn: 1 });
    const stored = await rows(id);
    expect(stored.find((r) => r.date.toISOString().slice(0, 10) === today)).toMatchObject({ steps: 3000, source: "MANUAL" });
  });

  it("typing over a synced day makes it hers from then on", async () => {
    const { token, id } = await signUp("override");
    const day = dayOffset(-1);
    await sync(token, { source: "DEVICE", days: [{ date: day, steps: 6000 }] });
    await request(app).post("/api/v1/activity/steps").set(auth(token)).send({ date: day, steps: 7000 });
    const again = await sync(token, { source: "DEVICE", days: [{ date: day, steps: 6500 }] });
    expect(again.body.data.keptOwn).toBe(1);
    expect((await rows(id))[0]).toMatchObject({ steps: 7000, source: "MANUAL", syncedAt: null });
  });

  it("updates a day an earlier sync wrote (today grows) and repeating the same numbers changes nothing", async () => {
    const { token, id } = await signUp("grow");
    const day = dayOffset(0);
    await sync(token, { source: "DEVICE", days: [{ date: day, steps: 1000 }] });
    expect((await sync(token, { source: "DEVICE", days: [{ date: day, steps: 2500 }] })).body.data).toEqual({ saved: 1, keptOwn: 0 });
    expect((await sync(token, { source: "DEVICE", days: [{ date: day, steps: 2500 }] })).body.data).toEqual({ saved: 0, keptOwn: 0 });
    expect(await rows(id)).toHaveLength(1);
    expect((await rows(id))[0].steps).toBe(2500);
  });

  it("refuses a future day, a day too far back, duplicates, impossible counts and an empty or oversized list", async () => {
    const { token } = await signUp("refuse");
    expect((await sync(token, { source: "DEVICE", days: [{ date: dayOffset(3), steps: 100 }] })).status).toBe(400);
    expect((await sync(token, { source: "DEVICE", days: [{ date: dayOffset(-120), steps: 100 }] })).status).toBe(400);
    expect((await sync(token, { source: "DEVICE", days: [{ date: dayOffset(-1), steps: 1 }, { date: dayOffset(-1), steps: 2 }] })).status).toBe(422);
    expect((await sync(token, { source: "DEVICE", days: [{ date: dayOffset(-1), steps: -5 }] })).status).toBe(422);
    expect((await sync(token, { source: "DEVICE", days: [{ date: dayOffset(-1), steps: 900_000 }] })).status).toBe(422);
    expect((await sync(token, { source: "DEVICE", days: [] })).status).toBe(422);
    expect((await sync(token, { source: "MANUAL", days: [{ date: dayOffset(-1), steps: 100 }] })).status).toBe(422);
    const many = Array.from({ length: 91 }, (_, i) => ({ date: dayOffset(-(i % 90)), steps: i }));
    expect((await sync(token, { source: "DEVICE", days: many })).status).toBe(422);
  });

  it("needs a signed-in account and only ever touches her own days", async () => {
    expect((await request(app).post("/api/v1/activity/steps/sync").send({ source: "DEVICE", days: [{ date: dayOffset(-1), steps: 1 }] })).status).toBe(401);
    const a = await signUp("a");
    const b = await signUp("b");
    await sync(a.token, { source: "DEVICE", days: [{ date: dayOffset(-1), steps: 111 }] });
    await sync(b.token, { source: "DEVICE", days: [{ date: dayOffset(-1), steps: 222 }] });
    expect((await rows(a.id))[0].steps).toBe(111);
    expect((await rows(b.id))[0].steps).toBe(222);
  });

  it("comes with her data download, source included", async () => {
    const { token } = await signUp("export");
    await sync(token, { source: "IMPORT", days: [{ date: dayOffset(-1), steps: 4321 }] });
    const exported = (await request(app).get("/api/v1/users/me/export").set(auth(token))).body;
    const steps = (exported.data ?? exported).stepsLogs as { steps: number; source: string }[];
    expect(steps).toEqual([expect.objectContaining({ steps: 4321, source: "IMPORT" })]);
  });
});
