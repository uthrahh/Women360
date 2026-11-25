import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "@/app";
import { prisma } from "@/lib/prisma";
import { dateOfDay, dayNumber, isDue, progressOf, stateOf, weekdayOf, type Schedulable } from "@/modules/programmes/schedule";
import { checkAnswers } from "@/modules/programmes/questions";

const app = createApp();

async function registerUser(label: string) {
  const res = await request(app).post("/api/v1/auth/register").send({
    name: label,
    email: `${label.toLowerCase().replace(/\s+/g, "-")}.${Date.now()}.${Math.random().toString(36).slice(2)}@example.com`,
    password: "a-long-enough-password",
  });
  return { token: res.body.data.accessToken as string, id: res.body.data.user.id as string };
}
const promote = (id: string, role: "COACH" | "ADMIN") => prisma.user.update({ where: { id }, data: { role } });
const as = (token: string) => ({ Authorization: `Bearer ${token}` });

const task = (over: Partial<Schedulable> = {}): Schedulable => ({
  frequency: "DAILY", weekdays: [], startDay: 1, endDay: 30, status: "ACTIVE", published: true, endedOnDay: null, ...over,
});
const ev = (type: "DONE" | "SKIPPED" | "NEED_HELP" | "UNDONE" | "COACH_REPLY", ms: number, extra: { value?: number; note?: string } = {}) => ({
  type, value: extra.value ?? null, note: extra.note ?? null, createdAt: new Date(ms),
});

describe("programme schedule (pure)", () => {
  it("counts days from the start date and maps them back", () => {
    expect(dayNumber("2026-11-02", "2026-11-02")).toBe(1);
    expect(dayNumber("2026-11-02", "2026-12-01")).toBe(30);
    expect(dateOfDay("2026-11-02", 30)).toBe("2026-12-01");
    expect(weekdayOf("2026-11-02")).toBe(1); // a Monday
  });

  it("knows when a task is due, including after it was paused or replaced", () => {
    expect(isDue(task(), 5, 3)).toBe(true);
    expect(isDue(task({ published: false }), 5, 3)).toBe(false);
    expect(isDue(task({ frequency: "ONCE", startDay: 4, endDay: 4 }), 4, 0)).toBe(true);
    expect(isDue(task({ frequency: "ONCE", startDay: 4, endDay: 4 }), 5, 0)).toBe(false);
    expect(isDue(task({ frequency: "WEEKDAYS", weekdays: [1, 3] }), 5, 3)).toBe(true);
    expect(isDue(task({ frequency: "WEEKDAYS", weekdays: [1, 3] }), 5, 4)).toBe(false);
    // Paused after day 6: days 1-6 stay due (their history is kept), day 7 on is not.
    expect(isDue(task({ status: "PAUSED", endedOnDay: 6 }), 6, 0)).toBe(true);
    expect(isDue(task({ status: "PAUSED", endedOnDay: 6 }), 7, 0)).toBe(false);
    // Paused before it was ever due: never due.
    expect(isDue(task({ status: "PAUSED", endedOnDay: null }), 1, 0)).toBe(false);
  });

  it("reads the latest of her own reports and keeps every coach reply", () => {
    expect(stateOf([]).status).toBe("open");
    const s = stateOf([ev("NEED_HELP", 1, { note: "knee hurts" }), ev("COACH_REPLY", 2, { note: "try 10 minutes" }), ev("DONE", 3, { value: 10 })]);
    expect(s).toMatchObject({ status: "done", value: 10, helpOpen: false });
    expect(s.replies).toHaveLength(1);
    expect(stateOf([ev("DONE", 1), ev("UNDONE", 2)]).status).toBe("open");
    expect(stateOf([ev("NEED_HELP", 1)]).helpOpen).toBe(true);
  });

  it("measures engagement from due occurrences, not health", () => {
    const t = { ...task({ endDay: 3 }), id: "a" };
    const events = new Map([["a|2026-11-02", [ev("DONE", 1)]], ["a|2026-11-03", [ev("SKIPPED", 1)]]]);
    expect(progressOf([t], events, "2026-11-02", 3)).toEqual({ due: 3, done: 1, skipped: 1, activeDays: 1 });
  });
});

describe("programme questions (pure)", () => {
  it("lets a draft leave questions out but a submission must answer the required ones", () => {
    expect(checkAnswers("BASELINE", { water: 6 }, false).ok).toBe(true);
    const r = checkAnswers("BASELINE", { water: 6 }, true);
    expect(r.ok).toBe(false);
  });

  it("refuses unknown questions, out-of-range numbers and too many picks", () => {
    expect(checkAnswers("BASELINE", { weight: 70 }, false).ok).toBe(false);
    expect(checkAnswers("BASELINE", { water: 50 }, false).ok).toBe(false);
    expect(checkAnswers("BASELINE", { focus: ["eat_better", "move_more", "sleep_better", "stress_less"] }, false).ok).toBe(false);
    expect(checkAnswers("FINAL", { focus: ["eat_better"] }, false).ok).toBe(false); // not asked at the end
  });
});

const BASELINE = {
  focus: ["move_more", "sleep_better"], activeDays: 1, sleepHours: "5to6", homeMeals: "half", water: 4,
  energy: 2, stress: 4, timePerDay: "20", readiness: 4, forCoach: "I work late on Tuesdays",
};
const FINAL = { activeDays: 4, sleepHours: "6to7", homeMeals: "most", water: 7, energy: 4, stress: 3, readiness: 5, changed: "I walk after dinner now" };

describe("guided programme journey", () => {
  let woman: { token: string; id: string };
  let other: { token: string; id: string };
  let coach: { token: string; id: string };
  let otherCoach: { token: string; id: string };
  let admin: { token: string; id: string };
  let programmeId = "";
  let templateId = "";
  let enrolmentId = "";
  let taskId = "";

  beforeAll(async () => {
    [woman, other, coach, otherCoach, admin] = await Promise.all([
      registerUser("Prog Woman"), registerUser("Prog Other"), registerUser("Prog Coach"), registerUser("Prog Coach Two"), registerUser("Prog Admin"),
    ]);
    await Promise.all([promote(coach.id, "COACH"), promote(otherCoach.id, "COACH"), promote(admin.id, "ADMIN")]);
  });

  it("an administrator writes a programme and a task template, and only approved templates and published programmes are usable", async () => {
    const p = await request(app).post("/api/v1/admin/programme/programmes").set(as(admin.token)).send({ name: "30-day start", summary: "Small daily steps with a coach.", durationDays: 30 });
    expect(p.status).toBe(201);
    programmeId = p.body.data.id;
    // A draft programme can't be joined.
    expect((await request(app).post(`/api/v1/programmes/${programmeId}/join`).set(as(woman.token))).status).toBe(404);
    expect((await request(app).patch(`/api/v1/admin/programme/programmes/${programmeId}`).set(as(admin.token)).send({ status: "PUBLISHED" })).status).toBe(200);

    const t = await request(app).post("/api/v1/admin/programme/templates").set(as(admin.token)).send({
      title: "A 10-minute walk", category: "ACTIVITY", kind: "AMOUNT", unit: "minutes", instructions: "Walk at an easy pace after a meal.",
    });
    expect(t.status).toBe(201);
    expect(t.body.data.status).toBe("DRAFT");
    templateId = t.body.data.id;
    const a = await request(app).post(`/api/v1/admin/programme/templates/${templateId}/approve`).set(as(admin.token)).send({ reviewedBy: "Health content lead" });
    expect(a.body.data).toMatchObject({ status: "APPROVED", reviewedBy: "Health content lead" });
    // A woman or a coach can't reach the administrator's routes.
    expect((await request(app).get("/api/v1/admin/programme/templates").set(as(coach.token))).status).toBe(403);
  });

  it("she joins, saves her answers as a draft, comes back, and submits", async () => {
    const list = await request(app).get("/api/v1/programmes/me?today=2026-11-01").set(as(woman.token));
    expect(list.body.data.current).toBeNull();
    expect(list.body.data.available.map((p: { id: string }) => p.id)).toContain(programmeId);

    const j = await request(app).post(`/api/v1/programmes/${programmeId}/join`).set(as(woman.token));
    expect(j.status).toBe(201);
    enrolmentId = j.body.data.id;
    expect((await request(app).post(`/api/v1/programmes/${programmeId}/join`).set(as(woman.token))).status).toBe(409);

    const draft = await request(app).put("/api/v1/programmes/me/assessment").set(as(woman.token)).send({ kind: "BASELINE", answers: { water: 4 }, submit: false });
    expect(draft.status).toBe(200);
    const back = await request(app).get("/api/v1/programmes/me?today=2026-11-01").set(as(woman.token));
    expect(back.body.data.current.baseline).toMatchObject({ answers: { water: 4 }, submittedAt: null });
    expect((await prisma.assessment.findFirstOrThrow({ where: { enrolmentId } })).schemaVersion).toBe(1);

    const sub = await request(app).put("/api/v1/programmes/me/assessment").set(as(woman.token)).send({ kind: "BASELINE", answers: BASELINE, submit: true });
    expect(sub.body.data.status).toBe("WAITING_FOR_COACH");
    // Submitted answers can't be changed afterwards.
    expect((await request(app).put("/api/v1/programmes/me/assessment").set(as(woman.token)).send({ kind: "BASELINE", answers: BASELINE, submit: true })).status).toBe(409);
  });

  it("no coach sees her until an administrator assigns one, and then only that coach (QA-03)", async () => {
    expect((await request(app).get(`/api/v1/coach/programme/enrolments/${enrolmentId}?today=2026-11-01`).set(as(coach.token))).status).toBe(403);
    const assign = await request(app).put(`/api/v1/admin/programme/enrolments/${enrolmentId}/coach`).set(as(admin.token)).send({ coachId: coach.id });
    expect(assign.status).toBe(200);
    const d = await request(app).get(`/api/v1/coach/programme/enrolments/${enrolmentId}?today=2026-11-01`).set(as(coach.token));
    expect(d.status).toBe(200);
    expect(d.body.data).toMatchObject({ status: "PLANNING", baseline: { answers: { forCoach: "I work late on Tuesdays" } } });

    const denied = await request(app).get(`/api/v1/coach/programme/enrolments/${enrolmentId}?today=2026-11-01`).set(as(otherCoach.token));
    expect(denied.status).toBe(403);
    const logged = await prisma.auditLog.findFirst({ where: { actorId: otherCoach.id, action: "security.programme_access_denied", targetId: enrolmentId } });
    expect(logged).not.toBeNull();
    // A coach can't use the woman's routes either.
    expect((await request(app).get("/api/v1/programmes/me?today=2026-11-01").set(as(coach.token))).status).toBe(403);
  });

  it("the coach builds the plan from the library, and she sees nothing until it is published", async () => {
    const add = await request(app).post(`/api/v1/coach/programme/enrolments/${enrolmentId}/tasks`).set(as(coach.token)).send({
      templateId, title: "A 10-minute walk", category: "ACTIVITY", kind: "AMOUNT", unit: "minutes", target: 10,
      instructions: "Walk at an easy pace after a meal.", frequency: "DAILY", startDay: 1, endDay: 30,
    });
    expect(add.status).toBe(201);
    taskId = add.body.data.id;
    const custom = await request(app).post(`/api/v1/coach/programme/enrolments/${enrolmentId}/tasks`).set(as(coach.token)).send({
      title: "Lights out by 11", category: "SLEEP", kind: "CHECK", instructions: "Phone on the charger outside the bedroom.", frequency: "WEEKDAYS", weekdays: [0, 1, 2, 3, 4], startDay: 1, endDay: 30,
    });
    expect(custom.status).toBe(201);
    // Beyond the programme's length is refused.
    const tooLong = await request(app).post(`/api/v1/coach/programme/enrolments/${enrolmentId}/tasks`).set(as(coach.token)).send({
      title: "x", category: "SLEEP", kind: "CHECK", instructions: "x", frequency: "DAILY", startDay: 1, endDay: 31,
    });
    expect(tooLong.status).toBe(400);

    const before = await request(app).get("/api/v1/programmes/me?today=2026-11-02").set(as(woman.token));
    expect(before.body.data.current.status).toBe("PLANNING");
    expect(before.body.data.current.days).toEqual([]);

    const pub = await request(app).post(`/api/v1/coach/programme/enrolments/${enrolmentId}/publish`).set(as(coach.token)).send({ reason: "Your first plan" });
    expect(pub.body.data.version).toBe(1);
  });

  it("day 1 is the day she first opens it; a repeated report is not a second event (QA-09)", async () => {
    const me = await request(app).get("/api/v1/programmes/me?today=2026-11-02").set(as(woman.token));
    const cur = me.body.data.current;
    expect(cur).toMatchObject({ status: "ACTIVE", day: 1, startDate: "2026-11-02" });
    expect(cur.days[0].tasks.map((t: { title: string }) => t.title)).toEqual(["A 10-minute walk", "Lights out by 11"]);

    const body = { date: "2026-11-02", type: "DONE", value: 12 };
    expect((await request(app).post(`/api/v1/programmes/me/tasks/${taskId}/events?today=2026-11-02`).set(as(woman.token)).send(body)).status).toBe(200);
    await request(app).post(`/api/v1/programmes/me/tasks/${taskId}/events?today=2026-11-02`).set(as(woman.token)).send(body);
    expect(await prisma.taskEvent.count({ where: { taskId } })).toBe(1);
    // An amount task needs the amount.
    expect((await request(app).post(`/api/v1/programmes/me/tasks/${taskId}/events?today=2026-11-02`).set(as(woman.token)).send({ date: "2026-11-02", type: "DONE" })).status).toBe(400);
  });

  it("she can report the two days before today but not further back or ahead", async () => {
    const back3 = await request(app).post(`/api/v1/programmes/me/tasks/${taskId}/events?today=2026-11-06`).set(as(woman.token)).send({ date: "2026-11-03", type: "SKIPPED" });
    expect(back3.status).toBe(400);
    const back2 = await request(app).post(`/api/v1/programmes/me/tasks/${taskId}/events?today=2026-11-06`).set(as(woman.token)).send({ date: "2026-11-04", type: "SKIPPED", note: "rain" });
    expect(back2.status).toBe(200);
    const ahead = await request(app).post(`/api/v1/programmes/me/tasks/${taskId}/events?today=2026-11-06`).set(as(woman.token)).send({ date: "2026-11-07", type: "DONE", value: 10 });
    expect(ahead.status).toBe(400);
  });

  it("another woman can't touch her tasks or see her programme (QA-02)", async () => {
    const res = await request(app).post(`/api/v1/programmes/me/tasks/${taskId}/events?today=2026-11-02`).set(as(other.token)).send({ date: "2026-11-02", type: "DONE", value: 5 });
    expect(res.status).toBe(404);
    const mine = await request(app).get("/api/v1/programmes/me?today=2026-11-02").set(as(other.token));
    expect(mine.body.data.current).toBeNull();
  });

  it("asking for help reaches her coach, and the reply reaches her", async () => {
    await request(app).post(`/api/v1/programmes/me/tasks/${taskId}/events?today=2026-11-05`).set(as(woman.token)).send({ date: "2026-11-05", type: "NEED_HELP", note: "My knee aches on the stairs" });
    const load = await request(app).get("/api/v1/coach/programme/caseload?today=2026-11-05").set(as(coach.token));
    expect(load.body.data[0]).toMatchObject({ id: enrolmentId, helpOpen: 1, day: 4 });
    const d = await request(app).get(`/api/v1/coach/programme/enrolments/${enrolmentId}?today=2026-11-05`).set(as(coach.token));
    expect(d.body.data.helpRequests).toEqual([{ taskId, date: "2026-11-05", title: "A 10-minute walk", note: "My knee aches on the stairs" }]);

    const r = await request(app).post(`/api/v1/coach/programme/tasks/${taskId}/reply`).set(as(coach.token)).send({ date: "2026-11-05", note: "Walk on the flat for now." });
    expect(r.body.data.helpOpen).toBe(false);
    const me = await request(app).get("/api/v1/programmes/me?today=2026-11-05").set(as(woman.token));
    const walk = me.body.data.current.days[0].tasks.find((t: { id: string }) => t.id === taskId);
    expect(walk.state.replies[0].note).toBe("Walk on the flat for now.");
  });

  it("changing a published task keeps its past and makes a new version she can read (QA-11)", async () => {
    const noReason = await request(app).patch(`/api/v1/coach/programme/tasks/${taskId}?today=2026-11-06`).set(as(coach.token)).send({
      title: "A 15-minute walk", category: "ACTIVITY", kind: "AMOUNT", unit: "minutes", target: 15, instructions: "Walk on the flat.", frequency: "DAILY", startDay: 1, endDay: 30,
    });
    expect(noReason.status).toBe(400);
    const ch = await request(app).patch(`/api/v1/coach/programme/tasks/${taskId}?today=2026-11-06`).set(as(coach.token)).send({
      title: "A 15-minute walk", category: "ACTIVITY", kind: "AMOUNT", unit: "minutes", target: 15, instructions: "Walk on the flat.", frequency: "DAILY", startDay: 1, endDay: 30, reason: "You're ready for a little more",
    });
    expect(ch.status).toBe(200);
    expect(ch.body.data).toMatchObject({ title: "A 15-minute walk", startDay: 5 });
    const old = await prisma.programmeTask.findUniqueOrThrow({ where: { id: taskId } });
    expect(old).toMatchObject({ status: "REPLACED", endedOnDay: 4 });
    expect(await prisma.taskEvent.count({ where: { taskId } })).toBeGreaterThan(0); // nothing she reported was lost

    const me = await request(app).get("/api/v1/programmes/me?today=2026-11-06").set(as(woman.token));
    expect(me.body.data.current.changes[0]).toMatchObject({ version: 2, reason: "You're ready for a little more" });
    const titles = me.body.data.current.days[0].tasks.map((t: { title: string }) => t.title);
    expect(titles).toContain("A 15-minute walk");
    expect(titles).not.toContain("A 10-minute walk");
    expect(await prisma.planVersion.count({ where: { enrolmentId } })).toBe(2);
  });

  it("pausing ends a task yesterday and resuming carries on from today", async () => {
    const t = (await prisma.programmeTask.findFirstOrThrow({ where: { enrolmentId, title: "Lights out by 11" } })).id;
    const p = await request(app).post(`/api/v1/coach/programme/tasks/${t}/state?today=2026-11-08`).set(as(coach.token)).send({ action: "pause", reason: "Night shifts this week" });
    expect(p.body.data).toMatchObject({ status: "PAUSED", endedOnDay: 6 });
    const r = await request(app).post(`/api/v1/coach/programme/tasks/${t}/state?today=2026-11-12`).set(as(coach.token)).send({ action: "resume", reason: "Back to days" });
    expect(r.body.data).toMatchObject({ status: "ACTIVE", startDay: 11 });
    // Published tasks can't be deleted.
    expect((await request(app).delete(`/api/v1/coach/programme/tasks/${t}`).set(as(coach.token))).status).toBe(409);
  });

  it("a weekly review is shared with her; after the last day she answers the final questions and the final review completes it (QA-15)", async () => {
    const wr = await request(app).post(`/api/v1/coach/programme/enrolments/${enrolmentId}/reviews`).set(as(coach.token)).send({ kind: "WEEKLY", notes: "Good first week.", nextReviewOn: "2026-11-16" });
    expect(wr.status).toBe(201);
    expect((await request(app).post(`/api/v1/coach/programme/enrolments/${enrolmentId}/reviews`).set(as(coach.token)).send({ kind: "FINAL", notes: "x" })).status).toBe(409);

    const after = await request(app).get("/api/v1/programmes/me?today=2026-12-02").set(as(woman.token));
    expect(after.body.data.current).toMatchObject({ status: "FINAL_ASSESSMENT", day: 30, nextReviewOn: "2026-11-16" });
    expect(after.body.data.current.reviews[0].notes).toBe("Good first week.");

    const fin = await request(app).put("/api/v1/programmes/me/assessment").set(as(woman.token)).send({ kind: "FINAL", answers: FINAL, submit: true });
    expect(fin.body.data.status).toBe("FINAL_REVIEW");
    const done = await request(app).post(`/api/v1/coach/programme/enrolments/${enrolmentId}/reviews`).set(as(coach.token)).send({ kind: "FINAL", notes: "You built a walking habit." });
    expect(done.status).toBe(201);

    const end = await request(app).get("/api/v1/programmes/me?today=2026-12-03").set(as(woman.token));
    expect(end.body.data.current.status).toBe("COMPLETED");
    expect(end.body.data.current.comparison).toContainEqual({ id: "activeDays", before: 1, after: 4 });
    // The coach's access ended with the programme.
    expect((await request(app).get(`/api/v1/coach/programme/enrolments/${enrolmentId}?today=2026-12-03`).set(as(coach.token))).status).toBe(403);
  });

  it("her export includes the programme, her answers and every task report", async () => {
    const res = await request(app).get("/api/v1/users/me/export").set(as(woman.token));
    const p = res.body.data?.programmes ?? res.body.programmes;
    expect(p).toHaveLength(1);
    expect(p[0].assessments).toHaveLength(2);
    expect(p[0].tasks.some((t: { events: unknown[] }) => t.events.length > 0)).toBe(true);
  });

  it("sample programmes are offered only to demonstration accounts", async () => {
    const demo = await prisma.programme.create({ data: { name: "Sample", summary: "Sample", durationDays: 7, status: "PUBLISHED", demoOnly: true } });
    const res = await request(app).get("/api/v1/programmes/me?today=2026-11-01").set(as(other.token));
    expect(res.body.data.available.map((p: { id: string }) => p.id)).not.toContain(demo.id);
    expect((await request(app).post(`/api/v1/programmes/${demo.id}/join`).set(as(other.token))).status).toBe(404);
    await prisma.programme.delete({ where: { id: demo.id } });
  });
});
