import type { CycleSummary } from "@/types";

/**
 * The cycle shows at the top of the home screen only while it matters: while she is
 * menstruating, and during ovulation only if she has turned that on (Cycle > Settings).
 * The rest of the time it stays out of the way; the Cycle page has it all.
 */
export function cycleCardPhase(
  cycle: Pick<CycleSummary, "currentDay" | "phase" | "isLate">,
  showOvulation: boolean
): "menstrual" | "ovulation" | null {
  if (cycle.currentDay === null || cycle.isLate) return null;
  if (cycle.phase === "menstrual") return "menstrual";
  if (cycle.phase === "ovulation" && showOvulation) return "ovulation";
  return null;
}
