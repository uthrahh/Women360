import { dayNumber, toIsoDay } from "@/lib/streak";
import type { Screening } from "./guidelines";

/** Whole years between a date of birth and a day (both YYYY-MM-DD). */
export function ageOn(dob: string, day: string): number {
  const [by, bm, bd] = dob.split("-").map(Number);
  const [ty, tm, td] = day.split("-").map(Number);
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age -= 1;
  return age;
}

/** Adds calendar months to a day, clamping to the end of a shorter month (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(day: string, months: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(d, lastDay));
  return toIsoDay(first);
}

export type ScreeningStatus =
  | "needs_dob" //   we can't say without a date of birth
  | "later" //       not yet in the programme's age range
  | "beyond" //      past the programme's stated range: ask a doctor
  | "not_recorded" // in range, no record of when she last had it
  | "due" //         the interval has passed
  | "soon" //        due within the next two months
  | "up_to_date";

export interface ScreeningState {
  status: ScreeningStatus;
  lastDoneOn: string | null;
  nextDueOn: string | null;
  /** Years until she reaches the starting age, when status is "later". */
  startsInYears: number | null;
}

const SOON_DAYS = 60;

export function screeningState(
  s: Pick<Screening, "startAge" | "endAge" | "intervalMonths">,
  dob: string | null,
  today: string,
  lastDoneOn: string | null
): ScreeningState {
  const blank = { lastDoneOn, nextDueOn: null, startsInYears: null };
  if (!dob) return { ...blank, status: "needs_dob" };

  const age = ageOn(dob, today);
  if (age < s.startAge) return { ...blank, status: "later", startsInYears: s.startAge - age };

  const nextDueOn = lastDoneOn ? addMonths(lastDoneOn, s.intervalMonths) : null;

  // Past the stated range, a recent record is still shown as what it is; with
  // none, the honest answer is "ask your doctor", not "you're overdue".
  if (s.endAge !== undefined && age > s.endAge && !lastDoneOn) return { ...blank, status: "beyond" };

  if (!lastDoneOn || !nextDueOn) return { ...blank, status: "not_recorded" };

  const daysLeft = dayNumber(nextDueOn) - dayNumber(today);
  const status: ScreeningStatus = daysLeft <= 0 ? "due" : daysLeft <= SOON_DAYS ? "soon" : "up_to_date";
  return { lastDoneOn, nextDueOn, startsInYears: null, status };
}
