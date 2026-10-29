import { describe, expect, it } from "vitest";
import { addDaysISO, defaultWakeDate, derivedBedDate, sleepSpanHours } from "./sleepSpan";

describe("sleep span", () => {
  it("adds days across month and year ends", () => {
    expect(addDaysISO("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDaysISO("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysISO("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("puts the wake day one day after the bed day when the night crosses midnight", () => {
    expect(defaultWakeDate("2026-10-28", "23:00", "07:00")).toBe("2026-10-29");
    expect(defaultWakeDate("2026-10-28", "22:30", "06:15")).toBe("2026-10-29");
  });

  it("keeps the wake day the same when she went to bed after midnight", () => {
    expect(defaultWakeDate("2026-10-29", "01:00", "08:30")).toBe("2026-10-29");
    expect(defaultWakeDate("2026-10-29", "13:00", "14:30")).toBe("2026-10-29");
  });

  it("measures the span from the days and times", () => {
    expect(sleepSpanHours("2026-10-28", "23:00", "2026-10-29", "07:00")).toBe(8);
    expect(sleepSpanHours("2026-10-29", "01:00", "2026-10-29", "08:30")).toBe(7.5);
    expect(sleepSpanHours("2026-12-31", "23:30", "2027-01-01", "06:00")).toBe(6.5);
  });

  it("says no when waking isn't after bed or it's more than a day", () => {
    expect(sleepSpanHours("2026-10-29", "23:00", "2026-10-29", "07:00")).toBeNull();
    expect(sleepSpanHours("2026-10-28", "23:00", "2026-10-28", "23:00")).toBeNull();
    expect(sleepSpanHours("2026-10-27", "23:00", "2026-10-29", "07:00")).toBeNull();
  });

  it("works out the bed day for an older entry from its two times", () => {
    expect(derivedBedDate("2026-10-29", "23:00", "07:00")).toBe("2026-10-28");
    expect(derivedBedDate("2026-10-29", "01:00", "08:00")).toBe("2026-10-29");
  });
});
