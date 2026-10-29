import { describe, expect, it } from "vitest";
import { cycleCardPhase } from "./cycleCard";

type C = Parameters<typeof cycleCardPhase>[0];
const cycle = (phase: C["phase"], over: Partial<C> = {}): C => ({ currentDay: 3, phase, isLate: false, ...over });

describe("when the cycle shows on the home screen", () => {
  it("shows while she is menstruating, whether or not ovulation is turned on", () => {
    expect(cycleCardPhase(cycle("menstrual"), false)).toBe("menstrual");
    expect(cycleCardPhase(cycle("menstrual"), true)).toBe("menstrual");
  });
  it("shows during ovulation only when she has turned that on", () => {
    expect(cycleCardPhase(cycle("ovulation"), false)).toBeNull();
    expect(cycleCardPhase(cycle("ovulation"), true)).toBe("ovulation");
  });
  it("stays hidden in the follicular and luteal phases, however she has set it", () => {
    for (const phase of ["follicular", "luteal"] as const) {
      expect(cycleCardPhase(cycle(phase), false)).toBeNull();
      expect(cycleCardPhase(cycle(phase), true)).toBeNull();
    }
  });
  it("stays hidden when there is no cycle yet, and when the period is late", () => {
    expect(cycleCardPhase(cycle(null, { currentDay: null }), true)).toBeNull();
    expect(cycleCardPhase(cycle("late", { isLate: true }), true)).toBeNull();
    expect(cycleCardPhase(cycle("menstrual", { isLate: true }), true)).toBeNull();
  });
});
