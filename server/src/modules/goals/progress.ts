import type { GoalKind } from "@prisma/client";

interface ProgressInput {
  kind: GoalKind;
  completed: boolean;
  currentValue: number;
  targetValue: number;
  startValue: number | null;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/**
 * How far along a goal is, 0-100, always computed from the numbers behind it
 * (never a stored percentage that could drift):
 *  - TOTAL: how much of the target total is done;
 *  - REACH: how far the number has moved from where it started toward the
 *    target, in whichever direction the target lies (72 -> 67 and 50 -> 60 both work);
 *  - ONE_OFF: done or not.
 */
export function goalProgressPct(goal: ProgressInput): number {
  if (goal.kind === "ONE_OFF") return goal.completed ? 100 : 0;
  if (goal.kind === "REACH") {
    const start = goal.startValue ?? goal.currentValue;
    const span = goal.targetValue - start;
    if (span === 0) return goal.currentValue === goal.targetValue ? 100 : 0;
    return clamp(((goal.currentValue - start) / span) * 100);
  }
  if (goal.targetValue <= 0) return 0;
  return clamp((goal.currentValue / goal.targetValue) * 100);
}
