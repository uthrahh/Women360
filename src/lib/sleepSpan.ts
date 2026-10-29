/** "YYYY-MM-DD" plus a number of days, in the calendar she sees (no timezone shift). */
export function addDaysISO(isoDay: string, days: number): string {
  const [y, m, d] = isoDay.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

const minutesOf = (time24: string) => {
  const [h, m] = time24.split(":").map(Number);
  return h * 60 + m;
};

/**
 * The day she most likely woke, given the day and time she went to bed. Going to bed in the
 * evening and waking in the morning crosses midnight, so the wake day is the next one. Going to
 * bed after midnight (1:00 to wake at 8:00) is the same calendar day. She can change it either way.
 */
export function defaultWakeDate(bedDate: string, bedTime24: string, wakeTime24: string): string {
  return minutesOf(wakeTime24) <= minutesOf(bedTime24) ? addDaysISO(bedDate, 1) : bedDate;
}

/** Hours between going to bed and waking, to one decimal; null when waking isn't after bed or it's over 24 hours. */
export function sleepSpanHours(bedDate: string, bedTime24: string, wakeDate: string, wakeTime24: string): number | null {
  const [by, bm, bd] = bedDate.split("-").map(Number);
  const [wy, wm, wd] = wakeDate.split("-").map(Number);
  const dayGap = (Date.UTC(wy, wm - 1, wd) - Date.UTC(by, bm - 1, bd)) / 86_400_000;
  const minutes = dayGap * 1440 + minutesOf(wakeTime24) - minutesOf(bedTime24);
  if (!(minutes > 0) || minutes > 1440) return null;
  return Math.round((minutes / 60) * 10) / 10;
}

/** The bed day for a night saved before it was asked: the day before the wake day when the clock wraps past midnight. */
export function derivedBedDate(wakeDate: string, bedTime24: string, wakeTime24: string): string {
  return minutesOf(bedTime24) > minutesOf(wakeTime24) ? addDaysISO(wakeDate, -1) : wakeDate;
}
