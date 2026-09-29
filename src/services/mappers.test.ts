import { describe, expect, it } from "vitest";
import { calcSleepDuration, goalProgress, hasAtMostOneDecimal, to12Hour, to24Hour, toBackendCycleEntry, toFrontendCycleSummary } from "./mappers";

describe("calcSleepDuration", () => {
  it("computes a same-night duration", () => {
    expect(calcSleepDuration("22:00", "23:30")).toBe(1.5);
  });

  it("handles midnight crossing (23:00 -> 07:00 = 8h)", () => {
    expect(calcSleepDuration("23:00", "07:00")).toBe(8);
  });

  it("handles a bedtime after midnight (00:30 -> 06:00)", () => {
    expect(calcSleepDuration("00:30", "06:00")).toBe(5.5);
  });

  it("treats an identical bedtime and wake time as a full 24h cycle", () => {
    expect(calcSleepDuration("07:00", "07:00")).toBe(24);
  });
});

describe("to12Hour / to24Hour round-trip", () => {
  it("converts 24h to 12h with AM/PM", () => {
    expect(to12Hour("23:00")).toBe("11:00 PM");
    expect(to12Hour("00:15")).toBe("12:15 AM");
    expect(to12Hour("12:00")).toBe("12:00 PM");
  });

  it("round-trips back to the original 24h value", () => {
    for (const t of ["23:00", "00:15", "12:00", "07:05", "18:45"]) {
      expect(to24Hour(to12Hour(t))).toBe(t);
    }
  });
});

describe("hasAtMostOneDecimal", () => {
  it("accepts integers and one-decimal values", () => {
    expect(hasAtMostOneDecimal(12)).toBe(true);
    expect(hasAtMostOneDecimal(12.3)).toBe(true);
    expect(hasAtMostOneDecimal(0)).toBe(true);
    expect(hasAtMostOneDecimal(4.5)).toBe(true);
  });

  it("rejects values with more than one decimal place", () => {
    expect(hasAtMostOneDecimal(12.34)).toBe(false);
    expect(hasAtMostOneDecimal(4.567)).toBe(false);
  });

  it("is not fooled by binary floating-point representation error", () => {
    // 0.1 + 0.2 famously !== 0.3 in floating point; the check must still pass.
    expect(hasAtMostOneDecimal(0.1 + 0.2)).toBe(true);
  });
});

describe("toFrontendCycleSummary", () => {
  const apiSummary = {
    currentDay: 10,
    phase: "late",
    isLate: true,
    daysLate: 3,
    cycleLength: 28,
    periodLength: 5,
    loggedPeriodLength: 5.5,
    nextPeriodDate: "2026-06-01T00:00:00.000Z",
    nextPeriodRangeStart: "2026-05-30T00:00:00.000Z",
    nextPeriodRangeEnd: "2026-06-03T00:00:00.000Z",
    fertileWindowStart: null,
    fertileWindowEnd: null,
    confidence: "low" as const,
    irregularityNote: "Your cycles have varied a lot recently.",
    lastCycleLengths: [26, 30, 28],
    history: [
      { date: "2026-05-01T00:00:00.000Z", isPeriod: true, flow: "MEDIUM", pain: 2, energy: null, mood: null, symptoms: ["Cramps"], notes: null },
    ],
  };

  it("carries the late-period and logged-period-length fields through untouched", () => {
    const result = toFrontendCycleSummary(apiSummary);
    expect(result.isLate).toBe(true);
    expect(result.daysLate).toBe(3);
    expect(result.phase).toBe("late");
    expect(result.loggedPeriodLength).toBe(5.5);
  });

  it("truncates ISO datetimes to plain dates and lowercases the history's flow", () => {
    const result = toFrontendCycleSummary(apiSummary);
    expect(result.nextPeriodRangeStart).toBe("2026-05-30");
    expect(result.history[0].flow).toBe("medium");
  });
});

describe("toBackendCycleEntry", () => {
  it("sends isPeriod exactly as given, never inferred from flow", () => {
    // A Spotting day explicitly marked NOT a period day must stay that way
    // — the whole point of the explicit toggle is that flow no longer
    // decides isPeriod on its own.
    expect(toBackendCycleEntry({ isPeriod: false, flow: "spotting" }).isPeriod).toBe(false);
    expect(toBackendCycleEntry({ isPeriod: true, flow: "spotting" }).isPeriod).toBe(true);
  });

  it("defaults isPeriod to false when the caller omits it entirely", () => {
    expect(toBackendCycleEntry({ flow: "medium" }).isPeriod).toBe(false);
  });

  it("uppercases flow for the backend enum", () => {
    expect(toBackendCycleEntry({ isPeriod: true, flow: "heavy" }).flow).toBe("HEAVY");
  });
});

describe("goalProgress", () => {
  it("computes current/target as a rounded percentage", () => {
    expect(goalProgress({ currentValue: 4, targetValue: 8 })).toBe(50);
  });

  it("clamps to 100 when current exceeds target", () => {
    expect(goalProgress({ currentValue: 12, targetValue: 8 })).toBe(100);
  });

  it("never goes negative and guards against a zero target", () => {
    expect(goalProgress({ currentValue: 5, targetValue: 0 })).toBe(0);
  });
});
