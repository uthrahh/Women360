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

async function registerUser(): Promise<string> {
  const res = await request(app)
    .post("/api/v1/auth/register")
    .send({ name: "Cycle CRUD Tester", email: `cycle-crud.${Date.now()}.${Math.random()}@example.com`, password: "a-long-enough-password" });
  return res.body.data.accessToken as string;
}

describe("cycle entries — CRUD and ownership", () => {
  it("upserts an entry and reads it back with the fields it was given", async () => {
    const token = await registerUser();
    const date = daysAgo(1);
    const put = await request(app)
      .put(`/api/v1/cycle/entries/${date}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ isPeriod: true, flow: "LIGHT", pain: 2, energy: 3, mood: "tired", symptoms: ["Cramps"], notes: "first day" });
    expect(put.status).toBe(200);
    expect(put.body.data.isPeriod).toBe(true);
    expect(put.body.data.flow).toBe("LIGHT");
    expect(put.body.data.pain).toBe(2);
    expect(put.body.data.mood).toBe("tired");

    // Upserting again with a different body updates rather than duplicates.
    const putAgain = await request(app)
      .put(`/api/v1/cycle/entries/${date}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ isPeriod: true, flow: "HEAVY" });
    expect(putAgain.status).toBe(200);
    expect(putAgain.body.data.flow).toBe("HEAVY");

    const list = await request(app)
      .get(`/api/v1/cycle/entries?from=${date}&to=${date}`)
      .set("Authorization", `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].flow).toBe("HEAVY");
  });

  it("lists only entries within the requested date range, in chronological order", async () => {
    const token = await registerUser();
    for (const days of [1, 10, 20, 40]) {
      await request(app)
        .put(`/api/v1/cycle/entries/${daysAgo(days)}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ isPeriod: true, flow: "MEDIUM" });
    }
    const res = await request(app)
      .get(`/api/v1/cycle/entries?from=${daysAgo(25)}&to=${daysAgo(5)}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2); // the 10-days-ago and 20-days-ago entries only
    const dates = res.body.data.map((e: { date: string }) => e.date.slice(0, 10));
    expect(dates).toEqual([...dates].sort()); // ascending
  });

  it("deletes an entry", async () => {
    const token = await registerUser();
    const date = daysAgo(2);
    await request(app).put(`/api/v1/cycle/entries/${date}`).set("Authorization", `Bearer ${token}`).send({ isPeriod: true });
    const del = await request(app).delete(`/api/v1/cycle/entries/${date}`).set("Authorization", `Bearer ${token}`);
    expect(del.status).toBe(204);

    const list = await request(app)
      .get(`/api/v1/cycle/entries?from=${date}&to=${date}`)
      .set("Authorization", `Bearer ${token}`);
    expect(list.body.data).toHaveLength(0);
  });

  it("returns 404 deleting an entry that doesn't exist", async () => {
    const token = await registerUser();
    const res = await request(app).delete(`/api/v1/cycle/entries/${daysAgo(99)}`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it("never lets one user read or delete another user's entries", async () => {
    const tokenA = await registerUser();
    const tokenB = await registerUser();
    const date = daysAgo(3);
    await request(app).put(`/api/v1/cycle/entries/${date}`).set("Authorization", `Bearer ${tokenA}`).send({ isPeriod: true, flow: "HEAVY", notes: "A's private note" });

    const listAsB = await request(app)
      .get(`/api/v1/cycle/entries?from=${date}&to=${date}`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(listAsB.body.data).toHaveLength(0);

    const deleteAsB = await request(app).delete(`/api/v1/cycle/entries/${date}`).set("Authorization", `Bearer ${tokenB}`);
    expect(deleteAsB.status).toBe(404); // B has no entry on that date — A's is invisible to them

    // A's entry is untouched.
    const listAsA = await request(app)
      .get(`/api/v1/cycle/entries?from=${date}&to=${date}`)
      .set("Authorization", `Bearer ${tokenA}`);
    expect(listAsA.body.data).toHaveLength(1);
  });
});

describe("cycle profile — GET/PUT", () => {
  it("defaults to a 28/5 profile and can be updated", async () => {
    const token = await registerUser();
    const initial = await request(app).get("/api/v1/cycle/profile").set("Authorization", `Bearer ${token}`);
    expect(initial.status).toBe(200);
    expect(initial.body.data.averageCycleLength).toBe(28);
    expect(initial.body.data.averagePeriodLength).toBe(5);

    const updated = await request(app)
      .put("/api/v1/cycle/profile")
      .set("Authorization", `Bearer ${token}`)
      .send({ averageCycleLength: 32, averagePeriodLength: 6 });
    expect(updated.status).toBe(200);
    expect(updated.body.data.averageCycleLength).toBe(32);

    const summary = await request(app).get("/api/v1/cycle/summary").set("Authorization", `Bearer ${token}`);
    expect(summary.body.data.cycleLength).toBe(32); // no logged cycles yet — uses the updated profile
  });

  it("rejects an out-of-range profile value", async () => {
    const token = await registerUser();
    const res = await request(app)
      .put("/api/v1/cycle/profile")
      .set("Authorization", `Bearer ${token}`)
      .send({ averageCycleLength: 200, averagePeriodLength: 5 });
    expect(res.status).toBe(422);
  });
});

describe("cycle summary — timezone override", () => {
  it("uses the client's local `today` when provided instead of the server clock", async () => {
    const token = await registerUser();
    await request(app).put(`/api/v1/cycle/entries/${daysAgo(5)}`).set("Authorization", `Bearer ${token}`).send({ isPeriod: true });

    const serverToday = await request(app).get("/api/v1/cycle/summary").set("Authorization", `Bearer ${token}`);
    // A client-supplied "today" one day later than the server's own idea of
    // today shifts currentDay by exactly one — proving the override is used.
    const tomorrow = new Date(Date.now() + DAY_MS).toISOString().slice(0, 10);
    const clientToday = await request(app)
      .get(`/api/v1/cycle/summary?today=${tomorrow}`)
      .set("Authorization", `Bearer ${token}`);

    expect(clientToday.body.data.currentDay).toBe(serverToday.body.data.currentDay + 1);
  });
});
