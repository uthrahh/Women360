import type { PlanFeasibilityLevel } from "@/types";

export const WEEKDAYS = [
  { iso: 1, short: "Mon", long: "Monday" },
  { iso: 2, short: "Tue", long: "Tuesday" },
  { iso: 3, short: "Wed", long: "Wednesday" },
  { iso: 4, short: "Thu", long: "Thursday" },
  { iso: 5, short: "Fri", long: "Friday" },
  { iso: 6, short: "Sat", long: "Saturday" },
  { iso: 7, short: "Sun", long: "Sunday" },
];

/** "Tue 4 Nov" for a "YYYY-MM-DD" day, in her own language and without a timezone shift. */
export function dayLabel(isoDay: string): string {
  const [y, m, d] = isoDay.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

export const FEASIBILITY_TONE: Record<PlanFeasibilityLevel, "success" | "accent" | "warning"> = {
  ALREADY_THERE: "success",
  COMFORTABLE: "success",
  ACHIEVABLE: "accent",
  STRETCH: "warning",
  LIMITED_BY_TIME: "warning",
};

export const FEASIBILITY_LABEL: Record<PlanFeasibilityLevel, string> = {
  ALREADY_THERE: "Within reach now",
  COMFORTABLE: "Comfortable",
  ACHIEVABLE: "Achievable",
  STRETCH: "A stretch",
  LIMITED_BY_TIME: "Limited by time",
};

/** Toggles a weekday in a list, keeping it in week order. */
export function toggleDay(days: number[], iso: number): number[] {
  return (days.includes(iso) ? days.filter((d) => d !== iso) : [...days, iso]).sort((a, b) => a - b);
}
