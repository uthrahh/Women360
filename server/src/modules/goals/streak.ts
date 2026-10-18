const DAY_MS = 86_400_000;

/** "YYYY-MM-DD" -> whole days since the epoch (UTC, so DST can't skew it). */
export function dayNumber(isoDay: string): number {
  return Math.floor(Date.parse(`${isoDay}T00:00:00.000Z`) / DAY_MS);
}

export function toIsoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isValidIsoDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && toIsoDay(parsed) === value;
}

export interface StreakResult {
  /** Consecutive days with a check-in, ending today or (if today isn't done yet) yesterday. */
  streak: number;
  checkedInToday: boolean;
}

/**
 * A streak is only "alive" through the end of today: if you checked in
 * yesterday but not yet today, it still counts, because today isn't over.
 * Missing a whole day ends it. There is deliberately no "you lost your streak"
 * state here — a broken streak is simply 0 and starts again.
 */
export function computeStreak(checkInDays: string[], today: string): StreakResult {
  const days = new Set(checkInDays.map(dayNumber));
  const todayNumber = dayNumber(today);
  const checkedInToday = days.has(todayNumber);
  let cursor = checkedInToday ? todayNumber : todayNumber - 1;
  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor -= 1;
  }
  return { streak, checkedInToday };
}
