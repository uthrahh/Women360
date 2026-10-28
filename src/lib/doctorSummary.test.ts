import { describe, expect, it } from "vitest";
import { buildDoctorSummary } from "./doctorSummary";
import type { ConditionInfo, HealthSignal } from "@/types";

const condition = (label: string, declared: boolean): ConditionInfo => ({ code: "PCOS", label, about: "", trackSymptoms: [], note: "", sources: [], declared });
const signal: HealthSignal = { key: "IRREGULAR_CYCLES", title: "Your cycle lengths have been outside the usual range", evidence: ["Your last 4 cycles were 41, 52, 38, 45 days long."], guideline: "", mayCheck: [], relatedTo: [], sources: [], nextStep: "" };

describe("summary for my doctor", () => {
  it("includes her numbers, the conditions she named and the patterns, and says it is not a diagnosis", () => {
    const text = buildDoctorSummary({ day: "2026-10-29", conditions: [condition("PCOS", true), condition("Thyroid", false)], cycleLengths: [41, 52, 38, 45], periodLength: 5, periodLengthLogged: false, signals: [signal] });
    expect(text).toContain("Conditions I've told Women360 about: PCOS");
    expect(text).not.toContain("Thyroid");
    expect(text).toContain("Recent cycle lengths: 41, 52, 38, 45 days (average 44).");
    expect(text).toContain("Usual period length: 5 days (my own estimate).");
    expect(text).toContain("- Your cycle lengths have been outside the usual range");
    expect(text).toContain("Your last 4 cycles were 41, 52, 38, 45 days long.");
    expect(text.trim().endsWith("It is not a diagnosis.")).toBe(true);
  });
  it("copes with nothing logged and no conditions", () => {
    const text = buildDoctorSummary({ day: "2026-10-29", conditions: [], cycleLengths: [], periodLength: 5, periodLengthLogged: true, signals: [] });
    expect(text).toContain("none");
    expect(text).toContain("not enough logged yet");
    expect(text).not.toContain("Patterns Women360 noticed");
  });
});
