import { describe, expect, it } from "vitest";
import { toggleDay, dayLabel } from "./activityPlan";

describe("activity plan helpers", () => {
  it("adds and removes a weekday, keeping Monday-first order", () => {
    expect(toggleDay([1, 3], 2)).toEqual([1, 2, 3]);
    expect(toggleDay([1, 2, 3], 2)).toEqual([1, 3]);
    expect(toggleDay([], 7)).toEqual([7]);
  });
  it("labels a day without shifting it by timezone", () => {
    expect(dayLabel("2026-11-04")).toMatch(/4/);
    expect(dayLabel("2026-01-01")).toMatch(/1/);
  });
});
