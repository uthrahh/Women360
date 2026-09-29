import { describe, expect, it } from "vitest";
import { computeCycleSummary, type PeriodDayInput } from "@/modules/cycle/cycle.service";

const DAY_MS = 86_400_000;
function d(iso: string): Date {
  return new Date(iso);
}
function period(startIso: string, days: number, flow: PeriodDayInput["flow"] = "MEDIUM"): PeriodDayInput[] {
  const start = d(startIso).getTime();
  return Array.from({ length: days }, (_, i) => ({ date: new Date(start + i * DAY_MS), flow }));
}

const DEFAULT_PROFILE = { averageCycleLength: 28, averagePeriodLength: 5 };

describe("computeCycleSummary — no data", () => {
  it("returns nulls and falls back to the profile with nothing logged", () => {
    const result = computeCycleSummary({
      periodDays: [],
      today: d("2026-01-15"),
      profile: { averageCycleLength: 35, averagePeriodLength: 7 },
      isPerimenopause: false,
    });
    expect(result.currentDay).toBeNull();
    expect(result.phase).toBeNull();
    expect(result.cycleLength).toBe(35);
    expect(result.periodLength).toBe(7);
    expect(result.loggedPeriodLength).toBeNull();
    expect(result.confidence).toBe("low");
    expect(result.irregularityNote).toMatch(/not enough logged cycles/i);
    expect(result.isLate).toBe(false);
  });
});

describe("computeCycleSummary — one period only", () => {
  it("computes currentDay and the logged period length from a single completed period", () => {
    const periodDays = period("2026-01-01", 5);
    const result = computeCycleSummary({
      periodDays,
      today: d("2026-01-10"),
      profile: { averageCycleLength: 28, averagePeriodLength: 6 },
      isPerimenopause: false,
    });
    expect(result.currentDay).toBe(10); // Jan 1 -> Jan 10 inclusive
    expect(result.loggedPeriodLength).toBe(5); // the actual logged run, not the profile's 6
    expect(result.periodLength).toBe(5);
    expect(result.cycleLength).toBe(28); // no completed cycle gap yet — falls back to profile
    expect(result.confidence).toBe("low");
  });
});

describe("computeCycleSummary — several regular cycles", () => {
  it("predicts from the median of the user's own cycles with high confidence", () => {
    const periodDays = [
      ...period("2026-01-01", 5),
      ...period("2026-01-29", 5), // +28
      ...period("2026-02-26", 5), // +28
      ...period("2026-03-26", 5), // +28
      ...period("2026-04-23", 5), // +28
    ];
    const result = computeCycleSummary({
      periodDays,
      today: d("2026-04-25"),
      profile: DEFAULT_PROFILE,
      isPerimenopause: false,
    });
    expect(result.cycleLength).toBe(28);
    expect(result.confidence).toBe("high");
    expect(result.lastCycleLengths).toEqual([28, 28, 28, 28]);
  });
});

describe("computeCycleSummary — consecutive period days", () => {
  it("counts a run of consecutive isPeriod days as a single period, not several", () => {
    const periodDays = [
      ...period("2026-01-01", 3), // Jan 1, 2, 3 — one run
      ...period("2026-01-29", 3), // a second run 28 days after the first's start
    ];
    const result = computeCycleSummary({
      periodDays,
      today: d("2026-01-30"),
      profile: DEFAULT_PROFILE,
      isPerimenopause: false,
    });
    // Only one gap between two starts — if the 3-day runs were miscounted
    // as 3 separate periods each, this would be very different.
    expect(result.lastCycleLengths).toEqual([28]);
  });
});

describe("computeCycleSummary — spotting handling", () => {
  it("does not let a leading spotting day count as the period's start", () => {
    const periodDays: PeriodDayInput[] = [
      { date: d("2026-01-01"), flow: "SPOTTING" },
      { date: d("2026-01-02"), flow: "MEDIUM" },
      { date: d("2026-01-03"), flow: "MEDIUM" },
    ];
    const result = computeCycleSummary({
      periodDays,
      today: d("2026-01-10"),
      profile: DEFAULT_PROFILE,
      isPerimenopause: false,
    });
    // currentDay counted from Jan 2 (first non-spotting day), not Jan 1.
    expect(result.currentDay).toBe(9);
  });

  it("does not count a spotting-only run as a period at all", () => {
    const periodDays: PeriodDayInput[] = [
      { date: d("2026-01-01"), flow: "SPOTTING" },
      { date: d("2026-01-02"), flow: "SPOTTING" },
      ...period("2026-01-15", 5, "MEDIUM"),
    ];
    const result = computeCycleSummary({
      periodDays,
      today: d("2026-01-20"),
      profile: DEFAULT_PROFILE,
      isPerimenopause: false,
    });
    // Only the real period (Jan 15) should be recognized as a start.
    expect(result.currentDay).toBe(6); // Jan 15 -> Jan 20 inclusive
    expect(result.loggedPeriodLength).toBeNull(); // only one completed... actually still ongoing
  });

  it("still counts trailing spotting as part of the period's logged length", () => {
    const periodDays: PeriodDayInput[] = [
      ...period("2026-01-01", 3, "MEDIUM"),
      { date: d("2026-01-04"), flow: "SPOTTING" },
      ...period("2026-01-29", 3, "MEDIUM"), // next period, proving the first is complete
    ];
    const result = computeCycleSummary({
      periodDays,
      today: d("2026-01-30"),
      profile: DEFAULT_PROFILE,
      isPerimenopause: false,
    });
    expect(result.loggedPeriodLength).toBe(4); // Jan 1 through Jan 4, spotting tail included
  });
});

describe("computeCycleSummary — late period", () => {
  it("flags isLate and stops reporting the phase as luteal once well past the predicted range", () => {
    const periodDays = [
      ...period("2026-01-01", 5),
      ...period("2026-01-29", 5),
      ...period("2026-02-26", 5),
      ...period("2026-03-26", 5), // last start; 28-day pattern, range ends ~30 days later
    ];
    const result = computeCycleSummary({
      periodDays,
      today: d("2026-05-01"), // 36 days after the last start — well past the range
      profile: DEFAULT_PROFILE,
      isPerimenopause: false,
    });
    expect(result.isLate).toBe(true);
    expect(result.phase).toBe("late");
    expect(result.daysLate).toBeGreaterThan(0);
  });

  it("does not flag a cycle still within its predicted range as late", () => {
    const periodDays = [...period("2026-01-01", 5), ...period("2026-01-29", 5)];
    const result = computeCycleSummary({
      periodDays,
      today: d("2026-02-05"), // day 8 of a fresh 28-day-ish cycle
      profile: DEFAULT_PROFILE,
      isPerimenopause: false,
    });
    expect(result.isLate).toBe(false);
    expect(result.phase).not.toBe("late");
  });
});

describe("computeCycleSummary — phase boundaries (28-day cycle, 5-day period)", () => {
  const periodDays = period("2026-01-01", 5); // a single 5-day period, matches the profile exactly
  const cases: [string, number, string][] = [
    ["2026-01-01", 1, "menstrual"],
    ["2026-01-05", 5, "menstrual"],
    ["2026-01-06", 6, "follicular"],
    ["2026-01-12", 12, "follicular"],
    ["2026-01-13", 13, "ovulation"],
    ["2026-01-16", 16, "ovulation"],
    ["2026-01-17", 17, "luteal"],
    ["2026-01-20", 20, "luteal"],
  ];

  it.each(cases)("day %s (currentDay %i) is %s", (todayIso, expectedDay, expectedPhase) => {
    const result = computeCycleSummary({
      periodDays,
      today: d(todayIso),
      profile: DEFAULT_PROFILE,
      isPerimenopause: false,
    });
    expect(result.currentDay).toBe(expectedDay);
    expect(result.phase).toBe(expectedPhase);
  });
});
