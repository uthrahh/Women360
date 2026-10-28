import { describe, expect, it } from "vitest";
import { buildPlan, ageOn, isoWeekday, addDays, type PlanBaseline, type PlanProfile, type PlanRequest } from "@/modules/activity/plan/planner";
import { GOALS } from "@/modules/activity/plan/guidelines";

const none: PlanBaseline = { aerobicEquivalent: 0, strengthPerWeek: 0, minutesByCode: {}, hasHistory: false };
const adult: PlanProfile = { age: 34, pregnancy: null, hasConditions: false, weightKg: 62 };
const request = (over: Partial<PlanRequest> = {}): PlanRequest => ({
  goal: "HEALTH",
  weeks: 12,
  days: [1, 2, 3, 5, 6],
  sessionMinutes: 45,
  startDate: "2026-11-02", // a Monday
  activityCodes: [],
  ...over,
});

describe("dates", () => {
  it("knows the ISO weekday and adds days across a month end", () => {
    expect(isoWeekday("2026-11-02")).toBe(1);
    expect(isoWeekday("2026-11-08")).toBe(7);
    expect(addDays("2026-11-28", 5)).toBe("2026-12-03");
  });
  it("works out age on a given day", () => {
    expect(ageOn("1990-11-03", "2026-11-02")).toBe(35);
    expect(ageOn("1990-11-02", "2026-11-02")).toBe(36);
    expect(ageOn(null, "2026-11-02")).toBeNull();
  });
});

describe("building up", () => {
  it("starts gently with no history and builds to the WHO minimum without jumping", () => {
    const plan = buildPlan(request(), adult, none);
    const eq = plan.weeksPlan.map((w) => w.aerobicEquivalent);
    expect(plan.weeksPlan).toHaveLength(12);
    expect(eq[0]).toBe(30);
    expect(eq[eq.length - 1]).toBe(150);
    for (let i = 1; i < eq.length; i++) {
      expect(eq[i]).toBeGreaterThanOrEqual(eq[i - 1]);
      // Never more than the larger of 15 minutes or 20% a week (plus rounding to 5).
      expect(eq[i] - eq[i - 1]).toBeLessThanOrEqual(Math.max(15, Math.ceil(eq[i - 1] * 0.2)) + 5);
    }
    expect(plan.weeksPlan[0].focus).toBe("Settle in");
    expect(plan.feasibility.level).toBe("ACHIEVABLE");
  });

  it("starts a little above what she already does, never below", () => {
    const plan = buildPlan(request(), adult, { ...none, aerobicEquivalent: 60, hasHistory: true, minutesByCode: { walking: 240 } });
    expect(plan.weeksPlan[0].aerobicEquivalent).toBeGreaterThanOrEqual(60);
    expect(plan.weeksPlan[0].aerobicEquivalent).toBeLessThanOrEqual(75);
    expect(plan.feasibility.reasons[0]).toMatch(/about 60 minutes/);
  });

  it("says a short plan is a stretch, and how long it would really take", () => {
    const plan = buildPlan(request({ weeks: 4 }), adult, none);
    expect(plan.feasibility.level).toBe("STRETCH");
    expect(plan.weeksPlan[3].aerobicEquivalent).toBeLessThan(GOALS.HEALTH.aerobicTarget);
    expect(plan.feasibility.reasons.join(" ")).toMatch(/about 8 weeks/);
    expect(plan.feasibility.suggestions.join(" ")).toMatch(/Choose 8 weeks/);
  });

  it("keeps it up when she already meets the target", () => {
    const plan = buildPlan(request(), adult, { aerobicEquivalent: 180, strengthPerWeek: 2, minutesByCode: { walking: 720 }, hasHistory: true });
    expect(plan.feasibility.level).toBe("ALREADY_THERE");
    expect(plan.weeksPlan.every((w) => w.aerobicEquivalent === 150)).toBe(true);
    expect(plan.weeksPlan[0].focus).toBe("Keep it going");
  });
});

describe("time available", () => {
  it("is honest that three short days cannot hold the WHO minimum, and says what would", () => {
    const plan = buildPlan(request({ days: [1, 3, 6], sessionMinutes: 30 }), adult, none);
    expect(plan.feasibility.level).toBe("LIMITED_BY_TIME");
    expect(plan.peakAerobic).toBeLessThan(150);
    expect(plan.feasibility.suggestions.join(" ")).toMatch(/more day|more minutes/);
    expect(plan.feasibility.suggestions.join(" ")).toMatch(/some activity is better than none/);
  });

  it("never schedules more on a day than the time she gave", () => {
    for (const goal of Object.keys(GOALS) as (keyof typeof GOALS)[]) {
      const plan = buildPlan(request({ goal, days: [2, 4, 6], sessionMinutes: 25 }), adult, none);
      for (const week of plan.weeksPlan) {
        const byDate = new Map<string, number>();
        for (const s of week.sessions) byDate.set(s.date, (byDate.get(s.date) ?? 0) + s.minutes);
        for (const total of byDate.values()) expect(total).toBeLessThanOrEqual(25);
      }
    }
  });

  it("only uses the weekdays she chose, on dates inside each week", () => {
    const plan = buildPlan(request({ startDate: "2026-11-04", days: [1, 3], weeks: 4 }), adult, none); // starts on a Wednesday
    const week1 = plan.weeksPlan[0].sessions.map((s) => s.date);
    expect(new Set(week1)).toEqual(new Set(["2026-11-04", "2026-11-09"]));
    for (const week of plan.weeksPlan) for (const s of week.sessions) expect([1, 3]).toContain(isoWeekday(s.date));
    expect(plan.endDate).toBe("2026-12-01");
  });
});

describe("strength and balance", () => {
  it("eases in strength, then does two a week on days with a rest day between", () => {
    const plan = buildPlan(request(), adult, none);
    expect(plan.weeksPlan[0].strengthSessions).toBe(1);
    expect(plan.weeksPlan[1].strengthSessions).toBe(1);
    const week3 = plan.weeksPlan[2].sessions.filter((s) => s.kind === "STRENGTH").map((s) => s.weekday);
    expect(week3).toHaveLength(2);
    expect(week3[1] - week3[0]).toBeGreaterThan(1);
  });

  it("puts balance first for a balance goal, and reports what could not fit", () => {
    const plan = buildPlan(request({ goal: "BALANCE", days: [1, 3, 5], sessionMinutes: 30 }), adult, none);
    expect(plan.weeksPlan[3].mobilitySessions).toBe(3);
    expect(plan.weeksPlan[3].strengthSessions).toBe(0);
    expect(plan.feasibility.reasons.join(" ")).toMatch(/fit 0 of the 2 strength sessions/);
  });

  it("asks three strength-and-balance days of someone 65 or over, with a balance note", () => {
    const plan = buildPlan(request(), { ...adult, age: 70 }, none);
    const week = plan.weeksPlan[4];
    expect(week.strengthSessions).toBe(3);
    expect(week.sessions.filter((s) => s.kind === "STRENGTH").every((s) => /balance/i.test(s.note ?? ""))).toBe(true);
    expect(plan.cautions.join(" ")).toMatch(/65 or over/);
  });
});

describe("safety", () => {
  const runner: PlanBaseline = { aerobicEquivalent: 90, strengthPerWeek: 0, minutesByCode: { running: 200 }, hasHistory: true };

  it("lets an otherwise healthy adult who runs keep running, counting hard minutes double", () => {
    const plan = buildPlan(request(), adult, runner);
    const runs = plan.weeksPlan[8].sessions.filter((s) => s.activityCode === "running");
    expect(runs.length).toBeGreaterThan(0);
    const week = plan.weeksPlan[8];
    expect(week.aerobicEquivalent).toBe(week.sessions.filter((s) => s.kind === "AEROBIC").reduce((n, s) => n + s.minutes * 2, 0));
  });

  it("never asks a pregnant woman for hard effort, and tells her to talk to her doctor first", () => {
    const plan = buildPlan(request(), { ...adult, pregnancy: "PREGNANT" }, runner);
    expect(plan.cautions[0]).toMatch(/pregnant/);
    const aerobic = plan.weeksPlan.flatMap((w) => w.sessions).filter((s) => s.kind === "AEROBIC");
    expect(aerobic.every((s) => s.activityCode === "walking")).toBe(true);
    expect(aerobic.every((s) => s.minutes * 1 > 0 && s.effort.toLowerCase().includes("brisk"))).toBe(true);
  });

  it("keeps hard effort out when she has listed health conditions, and says to check", () => {
    const plan = buildPlan(request(), { ...adult, hasConditions: true }, runner);
    expect(plan.cautions[0]).toMatch(/health conditions/);
    expect(plan.weeksPlan.flatMap((w) => w.sessions).some((s) => s.activityCode === "running")).toBe(false);
  });

  it("always carries the general caution and names its source and review state", () => {
    const plan = buildPlan(request(), adult, none);
    expect(plan.cautions.join(" ")).toMatch(/isn't medical advice/);
    expect(plan.source.label).toMatch(/WHO/);
    expect(plan.review.reviewed).toBe(false);
  });

  it("asks for a date of birth when it doesn't have one", () => {
    expect(buildPlan(request(), { ...adult, age: null }, none).cautions.join(" ")).toMatch(/date of birth/);
  });
});

describe("goals and details", () => {
  it("moves a stamina plan to the firmer end of moderate effort in its second half", () => {
    const plan = buildPlan(request({ goal: "STAMINA", days: [1, 2, 3, 4, 5, 6, 7], sessionMinutes: 60 }), adult, none);
    const early = plan.weeksPlan[1].sessions.find((s) => s.kind === "AEROBIC")!;
    const late = plan.weeksPlan[10].sessions.find((s) => s.kind === "AEROBIC")!;
    expect(early.intensity).toBe("MODERATE");
    expect(late.intensity).toBe("HIGH");
    expect(plan.aerobicTarget).toBe(225);
  });

  it("uses the activities she asked for, then the ones she already does, then walking", () => {
    const asked = buildPlan(request({ activityCodes: ["cycling"] }), adult, none);
    expect(asked.weeksPlan[3].sessions.find((s) => s.kind === "AEROBIC")!.activityCode).toBe("cycling");
    const history = buildPlan(request(), adult, { ...none, hasHistory: true, aerobicEquivalent: 40, minutesByCode: { swimming: 100 } });
    expect(history.weeksPlan[3].sessions.find((s) => s.kind === "AEROBIC")!.activityCode).toBe("swimming");
    expect(buildPlan(request(), adult, none).weeksPlan[3].sessions.find((s) => s.kind === "AEROBIC")!.activityCode).toBe("walking");
  });

  it("estimates calories only when it knows her weight", () => {
    const withWeight = buildPlan(request(), adult, none).weeksPlan[3].sessions[0];
    const without = buildPlan(request(), { ...adult, weightKg: null }, none).weeksPlan[3].sessions[0];
    expect(withWeight.caloriesEstimate).toBeGreaterThan(0);
    expect(without.caloriesEstimate).toBeNull();
  });

  it("gives the same plan for the same inputs", () => {
    expect(buildPlan(request(), adult, none)).toEqual(buildPlan(request(), adult, none));
  });
});
