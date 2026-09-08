import { describe, expect, it } from "vitest";
import { calcSleepDuration, goalProgress, hasAtMostOneDecimal, to12Hour, to24Hour } from "./mappers";

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
