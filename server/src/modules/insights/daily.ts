import { prisma } from "@/lib/prisma";

/**
 * Her own logs, one row per day, for the "See it together" chart: several things she tracks on one timeline. A value is null when
 * nothing was logged that day (never zero, which would read as "none"), so the chart shows a gap rather than a made-up dip.
 * No interpretation happens here: the chart shows what she logged, side by side.
 */
export interface DailyPoint {
  date: string;
  sleepHours: number | null;
  sleepQuality: number | null;
  mood: number | null;
  stress: number | null;
  energy: number | null;
  steps: number | null;
  activeMinutes: number | null;
  waterMl: number | null;
  caffeine: number | null;
  alcohol: number | null;
  /** True when she logged a period day. */
  period: boolean;
}

const DAY_MS = 86_400_000;
const key = (d: Date) => d.toISOString().slice(0, 10);
const asDate = (d: string) => new Date(`${d}T00:00:00.000Z`);

function sumBy<T>(rows: T[], dateOf: (r: T) => Date, value: (r: T) => number): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of rows) out.set(key(dateOf(r)), (out.get(key(dateOf(r))) ?? 0) + value(r));
  return out;
}

export async function dailySeries(userId: string, days: number, today: string): Promise<DailyPoint[]> {
  const end = asDate(today);
  const start = new Date(end.getTime() - (days - 1) * DAY_MS);
  const range = { gte: start, lte: end };
  const [sleep, wellbeing, steps, activity, water, body, cycle] = await Promise.all([
    prisma.sleepEntry.findMany({ where: { userId, date: range }, select: { date: true, durationHours: true, quality: true } }),
    prisma.wellbeingEntry.findMany({ where: { userId, date: range }, select: { date: true, mood: true, stress: true, energy: true } }),
    prisma.stepsLog.findMany({ where: { userId, date: range }, select: { date: true, steps: true } }),
    prisma.activityEntry.findMany({ where: { userId, date: range }, select: { date: true, durationMinutes: true } }),
    prisma.hydrationLog.findMany({ where: { userId, date: range }, select: { date: true, amountMl: true } }),
    prisma.bodyLog.findMany({ where: { userId, date: range, kind: { in: ["caffeine", "alcohol"] } }, select: { date: true, kind: true } }),
    prisma.cycleEntry.findMany({ where: { userId, date: range, isPeriod: true }, select: { date: true } }),
  ]);

  const sleepBy = new Map(sleep.map((s) => [key(s.date), s]));
  const moodBy = new Map(wellbeing.map((w) => [key(w.date), w]));
  const stepsBy = new Map(steps.map((s) => [key(s.date), s.steps]));
  const activeBy = sumBy(activity, (a) => a.date, (a) => a.durationMinutes);
  const waterBy = sumBy(water, (w) => w.date, (w) => w.amountMl);
  const caffeineBy = sumBy(body.filter((b) => b.kind === "caffeine"), (b) => b.date, () => 1);
  const alcoholBy = sumBy(body.filter((b) => b.kind === "alcohol"), (b) => b.date, () => 1);
  const periodDays = new Set(cycle.map((c) => key(c.date)));

  return Array.from({ length: days }, (_, i) => {
    const date = key(new Date(start.getTime() + i * DAY_MS));
    const s = sleepBy.get(date);
    const w = moodBy.get(date);
    return {
      date,
      sleepHours: s?.durationHours ?? null,
      sleepQuality: s?.quality ?? null,
      mood: w?.mood ?? null,
      stress: w?.stress ?? null,
      energy: w?.energy ?? null,
      steps: stepsBy.get(date) ?? null,
      activeMinutes: activeBy.get(date) ?? null,
      waterMl: waterBy.get(date) ?? null,
      caffeine: caffeineBy.get(date) ?? null,
      alcohol: alcoholBy.get(date) ?? null,
      period: periodDays.has(date),
    };
  });
}
