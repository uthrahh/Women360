import type { ConditionInfo, HealthSignal } from "@/types";

/**
 * A plain-text summary she can paste into a message or read out at an appointment. It repeats
 * only what she logged and what she told us; it names no diagnosis the app made.
 */
export function buildDoctorSummary(input: {
  day: string;
  conditions: ConditionInfo[];
  cycleLengths: number[];
  periodLength: number;
  periodLengthLogged: boolean;
  signals: HealthSignal[];
}): string {
  const lines = [`Summary from Women360, from my own logs (${input.day})`, ""];
  const declared = input.conditions.filter((c) => c.declared).map((c) => c.label);
  lines.push(`Conditions I've told Women360 about: ${declared.length ? declared.join(", ") : "none"}`);
  if (input.cycleLengths.length > 0) {
    const avg = Math.round(input.cycleLengths.reduce((a, b) => a + b, 0) / input.cycleLengths.length);
    lines.push(`Recent cycle lengths: ${input.cycleLengths.join(", ")} days (average ${avg}).`);
  } else {
    lines.push("Recent cycle lengths: not enough logged yet.");
  }
  lines.push(`Usual period length: ${input.periodLength} days${input.periodLengthLogged ? " (from my logs)" : " (my own estimate)"}.`);
  if (input.signals.length > 0) {
    lines.push("", "Patterns Women360 noticed in my data:");
    for (const s of input.signals) {
      lines.push(`- ${s.title}`);
      for (const e of s.evidence) lines.push(`    ${e}`);
    }
  }
  lines.push("", "This comes from what I logged. It is not a diagnosis.");
  return lines.join("\n");
}
