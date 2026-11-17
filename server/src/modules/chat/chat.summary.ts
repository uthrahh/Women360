import { prisma } from "@/lib/prisma";
import { dailySeries, type DailyPoint } from "@/modules/insights/daily";
import { cycleService } from "@/modules/cycle/cycle.service";
import { habitsService } from "@/modules/habits/habits.service";

/**
 * What the AI chat may read about her, and only after she has agreed (Settings of the chat screen). Numbers only, for the last 30 days:
 * averages of what she logged, never a name, email, address, date of birth, medicine, allergy, note, symptom text, habit title, message,
 * contraception or pregnancy record. Anything else she wants the chat to know, she can say in her own words.
 * A value is null when she logged nothing that day: it is never zero, which would read as "none".
 */
const DAYS = 30;
const round1 = (n: number) => Math.round(n * 10) / 10;

interface Avg {
  /** Days with a value. */
  days: number;
  average: number | null;
}
function average(values: (number | null)[]): Avg {
  const v = values.filter((x): x is number => x !== null);
  return { days: v.length, average: v.length ? round1(v.reduce((a, b) => a + b, 0) / v.length) : null };
}

const METRICS = ["sleepHours", "sleepQuality", "mood", "stress", "energy", "steps", "activeMinutes", "waterMl"] as const;
type Metric = (typeof METRICS)[number];

export interface ChatSummary {
  window: { days: number; endsOn: string };
  ageBand: string | null;
  lifeStage: string | null;
  cycle: {
    phase: string | null;
    dayOfCycle: number | null;
    late: boolean;
    daysLate: number;
    usualCycleLengthDays: number;
    usualPeriodLengthDays: number;
    lastCycleLengthsDays: number[];
    confidence: "low" | "medium" | "high";
    periodDaysLogged: number;
  };
  /** Mood, stress and energy are 0 (lowest) to 4; sleep quality 1 to 5; sleep in hours; water in millilitres. */
  daily: Record<Metric, { last7Days: Avg; earlier: Avg; whole: Avg }>;
  drinks: { caffeineTotal: number; caffeineDays: number; alcoholTotal: number; alcoholDays: number };
  habits: { active: number; doneToday: number; longestStreak: number };
  note: string;
}

export function summarise(series: DailyPoint[], today: string): Pick<ChatSummary, "daily" | "drinks"> & { periodDaysLogged: number } {
  const last7 = series.slice(-7);
  const earlier = series.slice(0, -7);
  const daily = Object.fromEntries(
    METRICS.map((m) => [m, { last7Days: average(last7.map((d) => d[m])), earlier: average(earlier.map((d) => d[m])), whole: average(series.map((d) => d[m])) }])
  ) as ChatSummary["daily"];
  const total = (key: "caffeine" | "alcohol") => series.reduce((a, d) => a + (d[key] ?? 0), 0);
  const days = (key: "caffeine" | "alcohol") => series.filter((d) => (d[key] ?? 0) > 0).length;
  void today;
  return {
    daily,
    drinks: { caffeineTotal: total("caffeine"), caffeineDays: days("caffeine"), alcoholTotal: total("alcohol"), alcoholDays: days("alcohol") },
    periodDaysLogged: series.filter((d) => d.period).length,
  };
}

export async function buildSummary(userId: string, today: string): Promise<ChatSummary> {
  const [user, series, cycle, habits] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { dateOfBirth: true, lifeStage: true } }),
    dailySeries(userId, DAYS, today),
    cycleService.getSummary(userId, today),
    habitsService.list(userId, today),
  ]);
  const parts = summarise(series, today);
  const age = user.dateOfBirth ? new Date(`${today}T00:00:00Z`).getUTCFullYear() - user.dateOfBirth.getUTCFullYear() : null;
  return {
    window: { days: DAYS, endsOn: today },
    // A decade, never a birth date: enough to know which guidance applies.
    ageBand: age !== null && age >= 18 ? `${Math.floor(age / 10) * 10}s` : null,
    lifeStage: user.lifeStage ? user.lifeStage.toLowerCase() : null,
    cycle: {
      phase: cycle.phase ? String(cycle.phase).toLowerCase() : null,
      dayOfCycle: cycle.currentDay,
      late: cycle.isLate,
      daysLate: cycle.daysLate,
      usualCycleLengthDays: cycle.cycleLength,
      usualPeriodLengthDays: cycle.periodLength,
      lastCycleLengthsDays: cycle.lastCycleLengths.slice(-6),
      confidence: cycle.confidence,
      periodDaysLogged: parts.periodDaysLogged,
    },
    daily: parts.daily,
    drinks: parts.drinks,
    habits: { active: habits.length, doneToday: habits.filter((h) => h.doneToday).length, longestStreak: Math.max(0, ...habits.map((h) => h.streak)) },
    note: "Averages are over the days she logged (see days); null means nothing was logged. Mood, stress and energy run 0 to 4. This is a summary of her own entries, not a measurement.",
  };
}
