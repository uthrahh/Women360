import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "@/app";
import { addMonths, ageOn, screeningState } from "@/modules/screening/screening.logic";
import { SCREENINGS } from "@/modules/screening/guidelines";

const app = createApp();
const PASSWORD = "a-long-enough-password";
const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
const yearsAgo = (y: number) => day(Math.round(y * 365.25));

async function signUp(label: string) {
  const res = await request(app).post("/api/v1/auth/register").send({
    name: "Screening Tester",
    email: `${label}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`,
    password: PASSWORD,
  });
  expect(res.status).toBe(201);
  return res.body.data.accessToken as string;
}
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const setDob = (t: string, dateOfBirth: string) => request(app).patch("/api/v1/users/me").set(auth(t)).send({ dateOfBirth });
const list = (t: string) => request(app).get("/api/v1/screening").set(auth(t));
const markDone = (t: string, id: string, doneOn: string) =>
  request(app).post(`/api/v1/screening/${id}/records`).set(auth(t)).send({ doneOn });
const item = (body: { data: { items: { id: string }[] } }, id: string) =>
  body.data.items.find((i) => i.id === id) as unknown as { status: string; nextDueOn: string | null; lastDoneOn: string | null; lastRecordId: string | null };

describe("screening logic", () => {
  const bp = SCREENINGS.find((s) => s.id === "blood-pressure")!;
  const cervical = SCREENINGS.find((s) => s.id === "cervical")!;

  it("counts age by birthday, not by year", () => {
    expect(ageOn("1990-06-15", "2026-06-14")).toBe(35);
    expect(ageOn("1990-06-15", "2026-06-15")).toBe(36);
  });

  it("clamps month-end dates", () => {
    expect(addMonths("2024-01-31", 1)).toBe("2024-02-29");
    expect(addMonths("2025-01-31", 1)).toBe("2025-02-28");
    expect(addMonths("2024-03-10", 12)).toBe("2025-03-10");
    expect(addMonths("2021-11-30", 60)).toBe("2026-11-30");
  });

  it("asks for a date of birth rather than guessing", () => {
    expect(screeningState(bp, null, "2026-10-20", null).status).toBe("needs_dob");
  });

  it("says 'later' under the starting age, and how long", () => {
    const s = screeningState(bp, "2000-01-01", "2026-10-20", null);
    expect(s).toMatchObject({ status: "later", startsInYears: 4 });
  });

  it("is not_recorded in range with no record, never 'overdue'", () => {
    expect(screeningState(bp, "1990-01-01", "2026-10-20", null).status).toBe("not_recorded");
  });

  it("moves from up_to_date to soon to due as the interval passes", () => {
    expect(screeningState(bp, "1990-01-01", "2026-10-20", "2026-03-01").status).toBe("up_to_date");
    expect(screeningState(bp, "1990-01-01", "2026-10-20", "2025-12-01").status).toBe("soon");
    expect(screeningState(bp, "1990-01-01", "2026-10-20", "2025-10-20")).toMatchObject({ status: "due", nextDueOn: "2026-10-20" });
  });

  it("past the stated age range with no record says ask a doctor, not overdue", () => {
    expect(screeningState(cervical, "1950-01-01", "2026-10-20", null).status).toBe("beyond");
  });

  it("past the age range with a record still tracks its due date", () => {
    expect(screeningState(cervical, "1950-01-01", "2026-10-20", "2024-01-01").status).toBe("up_to_date");
  });

  it("blood pressure has no upper age in the programme", () => {
    expect(bp.endAge).toBeUndefined();
    expect(screeningState(bp, "1930-01-01", "2026-10-20", null).status).toBe("not_recorded");
  });

  it("every screening carries at least one named source and a positive interval", () => {
    for (const s of SCREENINGS) {
      expect(s.sources.length).toBeGreaterThan(0);
      expect(s.intervalMonths).toBeGreaterThan(0);
    }
  });
});

describe("screening API", () => {
  it("requires sign-in", async () => {
    expect((await request(app).get("/api/v1/screening")).status).toBe(401);
  });

  it("without a date of birth every item asks for it", async () => {
    const t = await signUp("sc-nodob");
    const res = await list(t);
    expect(res.status).toBe(200);
    expect(res.body.data.hasDateOfBirth).toBe(false);
    expect(res.body.data.items.every((i: { status: string }) => i.status === "needs_dob")).toBe(true);
    expect(res.body.data.disclaimer).toMatch(/not medical advice/i);
    expect(res.body.data.items[0].sources[0].label).toBeTruthy();
  });

  it("records a screening and computes when it is next due", async () => {
    const t = await signUp("sc-record");
    await setDob(t, yearsAgo(40));
    const before = await list(t);
    expect(item(before.body, "blood-pressure").status).toBe("not_recorded");

    const res = await markDone(t, "blood-pressure", day(30));
    expect(res.status).toBe(200);
    const bp = item(res.body, "blood-pressure");
    expect(bp.status).toBe("up_to_date");
    expect(bp.lastDoneOn).toBe(day(30));
    expect(bp.nextDueOn).toBeTruthy();
  });

  it("uses the latest record and does not stack duplicates for one day", async () => {
    const t = await signUp("sc-latest");
    await setDob(t, yearsAgo(40));
    await markDone(t, "blood-sugar", day(500));
    await markDone(t, "blood-sugar", day(10));
    const res = await markDone(t, "blood-sugar", day(10));
    expect(item(res.body, "blood-sugar").lastDoneOn).toBe(day(10));
    const exported = await request(app).get("/api/v1/users/me/export").set(auth(t));
    expect(exported.body.data.screeningRecords).toHaveLength(2);
  });

  it("undo removes the latest record and falls back to the one before", async () => {
    const t = await signUp("sc-undo");
    await setDob(t, yearsAgo(40));
    await markDone(t, "oral-exam", day(900));
    const res = await markDone(t, "oral-exam", day(5));
    const { lastRecordId } = item(res.body, "oral-exam");
    const del = await request(app).delete(`/api/v1/screening/oral-exam/records/${lastRecordId}`).set(auth(t));
    expect(del.status).toBe(204);
    expect(item((await list(t)).body, "oral-exam").lastDoneOn).toBe(day(900));
  });

  it("rejects a future date, a bad date and an unknown screening", async () => {
    const t = await signUp("sc-bad");
    await setDob(t, yearsAgo(40));
    expect((await markDone(t, "blood-pressure", day(-10))).status).toBe(400);
    expect((await markDone(t, "blood-pressure", "not-a-date")).status).toBe(422);
    expect((await markDone(t, "mammogram-from-nowhere", day(1))).status).toBe(422);
  });

  it("will not let one person delete another's record", async () => {
    const a = await signUp("sc-a");
    const b = await signUp("sc-b");
    await setDob(a, yearsAgo(40));
    const res = await markDone(a, "cervical", day(20));
    const { lastRecordId } = item(res.body, "cervical");
    const del = await request(app).delete(`/api/v1/screening/cervical/records/${lastRecordId}`).set(auth(b));
    expect(del.status).toBe(403);
    expect(item((await list(a)).body, "cervical").lastRecordId).toBe(lastRecordId);
  });

  it("is included in the data export", async () => {
    const t = await signUp("sc-export");
    await setDob(t, yearsAgo(40));
    await markDone(t, "blood-pressure", day(2));
    const exported = await request(app).get("/api/v1/users/me/export").set(auth(t));
    expect(exported.body.data.screeningRecords[0]).toMatchObject({ screeningId: "blood-pressure" });
  });
});
