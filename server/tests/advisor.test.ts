import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "@/app";
import { ideasFor, type AdvisorInput } from "@/modules/advisor/ideas";
import { toIdeas } from "@/modules/advisor/advisor.ai";

const app = createApp();

const base: AdvisorInput = {
  cycleTracking: true, existing: [], dismissed: [], waterGoalMl: 2200, waterDaysLogged7: 0, waterDaysMet7: 0, fruitVegGoal: 5, fruitVegDaysLogged7: 0,
  fruitVegDaysMet7: 0, activityTargets: [], activeDays7: 3, activeDaysEarlier: 6, sleepNights7: 0, sleepQuality7: null, sleepHours7: null, sleepHoursEarlier: null,
  moodDays7: 0, mood7: null, stress7: null, medicines: 0, medicineDosesMissed7: 0, lastAppointmentDaysAgo: 30, weekDay: 4,
};

describe("advisor ideas from her own logs (pure)", () => {
  it("says nothing when there is nothing to work on", () => {
    expect(ideasFor(base)).toEqual([]);
  });

  it("suggests from her own goals and says why in her numbers", () => {
    const ideas = ideasFor({ ...base, waterDaysLogged7: 6, waterDaysMet7: 1 });
    expect(ideas[0]).toMatchObject({ key: "water-meals", action: { type: "habit", title: "A glass of water with each meal" } });
    expect(ideas[0].why).toContain("1 of the last 7 days");
  });

  it("judges a weekly movement target against how much of the week has gone", () => {
    const behind = ideasFor({ ...base, weekDay: 6, activityTargets: [{ label: "Walking", minutes: 150, period: "WEEK", done: 20 }] });
    expect(behind.map((i) => i.key)).toContain("move-walking");
    const early = ideasFor({ ...base, weekDay: 1, activityTargets: [{ label: "Walking", minutes: 150, period: "WEEK", done: 20 }] });
    expect(early.map((i) => i.key)).not.toContain("move-walking");
  });

  it("orders by how far she is from her own goal, and leaves out what she has or declined", () => {
    const input = { ...base, waterDaysLogged7: 6, waterDaysMet7: 4, sleepNights7: 5, sleepQuality7: 1.4, lastAppointmentDaysAgo: null };
    const keys = ideasFor(input).map((i) => i.key);
    expect(keys[0]).toBe("sleep-phone");
    expect(keys).toContain("checkup");
    expect(ideasFor({ ...input, existing: ["phone out of the bedroom at night"], dismissed: ["checkup"] }).map((i) => i.key)).toEqual(["water-meals"]);
  });
});

describe("AI ideas are checked before she sees them", () => {
  it("drops medicine, supplement, fasting and weight ideas, malformed answers and habits she has", () => {
    const ideas = toIdeas(
      {
        ideas: [
          { title: "Take a vitamin supplement", why: "x y z", area: "food", type: "habit", daysPerWeek: 7, minutes: null },
          { title: "Try intermittent fasting", why: "x y z", area: "food", type: "habit", daysPerWeek: 7, minutes: null },
          { title: "Stretch before bed", why: "Your sleep quality was 2 of 5.", area: "sleep", type: "habit", daysPerWeek: 7, minutes: 5 },
          { title: "Walk after dinner", why: "You logged movement on 1 day.", area: "movement", type: "habit", daysPerWeek: 5, minutes: 10 },
        ],
      },
      ["walk after dinner"]
    );
    expect(ideas.map((i) => i.title)).toEqual(["Stretch before bed"]);
    expect(ideas[0].action).toMatchObject({ type: "habit", target: 5, unit: "minutes" });
    expect(toIdeas({ nonsense: true }, [])).toEqual([]);
  });
});

describe("advisor API", () => {
  it("lists her ideas and dismissing one keeps it away", async () => {
    const email = `adv.${Date.now()}.${Math.random().toString(36).slice(2)}@example.com`;
    const reg = await request(app).post("/api/v1/auth/register").send({ name: "Advice Seeker", email, password: "a-long-enough-password" });
    const auth = { Authorization: `Bearer ${reg.body.data.accessToken}` };
    const first = await request(app).get("/api/v1/advisor?today=2026-11-20").set(auth);
    expect(first.status).toBe(200);
    // A new account has no appointment on record, so a routine check-up is suggested.
    expect(first.body.data.ideas.map((i: { key: string }) => i.key)).toContain("checkup");
    await request(app).post("/api/v1/advisor/dismiss").set(auth).send({ key: "checkup" });
    const after = await request(app).get("/api/v1/advisor?today=2026-11-20").set(auth);
    expect(after.body.data.ideas.map((i: { key: string }) => i.key)).not.toContain("checkup");
    // Without agreeing to share, the AI reads nothing and suggests nothing.
    const ai = await request(app).post("/api/v1/advisor/ai").set(auth).send({ today: "2026-11-20" });
    expect(ai.body.data).toEqual({ ideas: [], needsSharing: true });
  });
});
