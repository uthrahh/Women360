import { describe, expect, it } from "vitest";
import { computeStreak, computeWeekStreak, isValidIsoDay, weekIndex, dayNumber } from "@/lib/streak";

describe("computeStreak", () => {
  it("counts consecutive days ending today", () => {
    expect(computeStreak(["2026-03-08", "2026-03-09", "2026-03-10"], "2026-03-10")).toEqual({ streak: 3, checkedInToday: true });
  });

  it("keeps the streak alive through today when yesterday was checked in", () => {
    expect(computeStreak(["2026-03-08", "2026-03-09"], "2026-03-10")).toEqual({ streak: 2, checkedInToday: false });
  });

  it("is 0 after a whole missed day", () => {
    expect(computeStreak(["2026-03-07", "2026-03-08"], "2026-03-10")).toEqual({ streak: 0, checkedInToday: false });
  });

  it("stops at the first gap and ignores older runs", () => {
    expect(computeStreak(["2026-03-01", "2026-03-02", "2026-03-09", "2026-03-10"], "2026-03-10").streak).toBe(2);
  });

  it("counts across month and year boundaries", () => {
    expect(computeStreak(["2025-12-30", "2025-12-31", "2026-01-01"], "2026-01-01").streak).toBe(3);
  });

  it("ignores duplicate days", () => {
    expect(computeStreak(["2026-03-10", "2026-03-10"], "2026-03-10").streak).toBe(1);
  });

  it("is 0 with no check-ins", () => {
    expect(computeStreak([], "2026-03-10")).toEqual({ streak: 0, checkedInToday: false });
  });
});

describe("isValidIsoDay", () => {
  it("accepts real dates only", () => {
    expect(isValidIsoDay("2026-02-28")).toBe(true);
    expect(isValidIsoDay("2026-02-30")).toBe(false);
    expect(isValidIsoDay("2026-2-3")).toBe(false);
    expect(isValidIsoDay("not-a-date")).toBe(false);
  });
});

describe("weeks", () => {
  it("starts weeks on Monday", () => {
    // 2026-03-02 is a Monday; the Sunday before it belongs to the previous week
    expect(weekIndex(dayNumber("2026-03-02"))).toBe(weekIndex(dayNumber("2026-03-08")));
    expect(weekIndex(dayNumber("2026-03-02")) - weekIndex(dayNumber("2026-03-01"))).toBe(1);
  });
});

describe("computeWeekStreak", () => {
  // Mon 2026-03-02 .. Sun 2026-03-08 is one week; the week before is 02-23..03-01
  const lastWeek = ["2026-02-23", "2026-02-25", "2026-02-27"];
  it("counts weeks that met their quota, with the current week still in progress", () => {
    const r = computeWeekStreak([...lastWeek, "2026-03-03"], "2026-03-04", 3);
    expect(r).toEqual({ streak: 1, thisWeek: 1 });
  });
  it("counts the current week once it is met", () => {
    const r = computeWeekStreak([...lastWeek, "2026-03-02", "2026-03-03", "2026-03-04"], "2026-03-04", 3);
    expect(r).toEqual({ streak: 2, thisWeek: 3 });
  });
  it("a missed whole week ends it", () => {
    expect(computeWeekStreak(["2026-02-16", "2026-02-17", "2026-02-18"], "2026-03-04", 3).streak).toBe(0);
  });
  it("is 0 with nothing logged", () => {
    expect(computeWeekStreak([], "2026-03-04", 3)).toEqual({ streak: 0, thisWeek: 0 });
  });
});
