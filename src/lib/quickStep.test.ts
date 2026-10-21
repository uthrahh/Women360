import { describe, expect, it } from "vitest";
import { quickStep } from "./quickStep";

describe("quickStep", () => {
  it("scales with the target", () => {
    expect(quickStep(8)).toBe(1);
    expect(quickStep(12)).toBe(1);
    expect(quickStep(30)).toBe(5);
    expect(quickStep(100)).toBe(10);
    expect(quickStep(1000)).toBe(100);
    expect(quickStep(10000)).toBe(1000);
  });

  it("falls back to 1 for a missing or invalid target", () => {
    expect(quickStep(0)).toBe(1);
    expect(quickStep(-5)).toBe(1);
    expect(quickStep(Number.NaN)).toBe(1);
  });
});
