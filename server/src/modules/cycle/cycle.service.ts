import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/lib/errors";
import type { Prisma } from "@prisma/client";

const DAY_MS = 86_400_000;
// Sperm can survive ~5 days pre-ovulation, an egg ~1 day post-ovulation —
// used to widen a single predicted ovulation date into a fertile window.
const FERTILE_WINDOW_BEFORE_DAYS = 5;
const FERTILE_WINDOW_AFTER_DAYS = 1;
// The luteal phase (ovulation -> next period) is far more consistent across
// cycles than the follicular phase, so ovulation is estimated backward from
// the predicted period date rather than forward from day 1 with a fixed
// "day 14" rule, which is wrong for most people.
const LUTEAL_PHASE_DAYS = 14;

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Median absolute deviation — like standard deviation but robust to the
// occasional outlier cycle (a single stressful/sick month shouldn't blow
// out the whole confidence estimate the way a mean/stdev would).
function medianAbsoluteDeviation(values: number[], center: number): number {
  if (values.length === 0) return 0;
  return median(values.map((v) => Math.abs(v - center)));
}

export type CyclePhase = "menstrual" | "follicular" | "ovulation" | "luteal" | "late";

export interface PeriodDayInput {
  date: Date;
  flow: "SPOTTING" | "LIGHT" | "MEDIUM" | "HEAVY" | null;
}

export interface CycleSummaryInput {
  /** Every isPeriod=true entry for this user, any order. */
  periodDays: PeriodDayInput[];
  today: Date;
  profile: { averageCycleLength: number; averagePeriodLength: number };
  isPerimenopause: boolean;
}

export interface CycleSummaryResult {
  currentDay: number | null;
  phase: CyclePhase | null;
  isLate: boolean;
  daysLate: number;
  cycleLength: number;
  periodLength: number;
  /** Average length of the user's own logged periods, or null with too few to average. */
  loggedPeriodLength: number | null;
  nextPeriodDate: Date | null;
  nextPeriodRangeStart: Date | null;
  nextPeriodRangeEnd: Date | null;
  fertileWindowStart: Date | null;
  fertileWindowEnd: Date | null;
  confidence: "low" | "medium" | "high";
  irregularityNote: string | null;
  lastCycleLengths: number[];
}

/**
 * Groups isPeriod=true days into distinct periods and decides, for each,
 * which day counts as its "start" for cycle-length math.
 *
 * Spotting handling (a deliberate product decision, not an oversight):
 * spotting alone never starts a period. Within a run of consecutive
 * isPeriod days, the start is the first day whose flow is NOT spotting
 * (including a day with no flow set at all — only an explicit SPOTTING
 * flow is excluded). A run that is spotting from end to end doesn't count
 * as a period at all for prediction purposes — it's still saved and still
 * shown as a period day on the calendar, it just can't anchor a cycle
 * length. This mirrors how Flo/Clue treat spotting (often pre-period,
 * mid-cycle, or breakthrough bleeding rather than day 1) and protects
 * prediction accuracy from being fragmented by it.
 *
 * A period's logged length is measured from its detected start through the
 * run's last day — so spotting that trails off at the end of a real period
 * still counts toward its length, but spotting that precedes the real flow
 * does not (consistent with it not being able to start the period either).
 */
function detectPeriods(periodDays: PeriodDayInput[]): { start: Date; end: Date }[] {
  const sorted = [...periodDays].sort((a, b) => a.date.getTime() - b.date.getTime());
  const runs: PeriodDayInput[][] = [];
  let current: PeriodDayInput[] = [];
  let prevDate: Date | null = null;
  for (const day of sorted) {
    if (prevDate && day.date.getTime() - prevDate.getTime() > DAY_MS) {
      runs.push(current);
      current = [];
    }
    current.push(day);
    prevDate = day.date;
  }
  if (current.length > 0) runs.push(current);

  const periods: { start: Date; end: Date }[] = [];
  for (const run of runs) {
    const startEntry = run.find((d) => d.flow !== "SPOTTING");
    if (!startEntry) continue; // entirely spotting — doesn't count as a period
    periods.push({ start: startEntry.date, end: run[run.length - 1].date });
  }
  return periods;
}

/**
 * Pure prediction/phase math — no database access, so it's directly
 * unit-testable. `getSummary` below is the only caller that touches Prisma.
 */
export function computeCycleSummary(input: CycleSummaryInput): CycleSummaryResult {
  const periods = detectPeriods(input.periodDays);
  const starts = periods.map((p) => p.start);

  const allCycleLengths: number[] = [];
  for (let i = 1; i < starts.length; i++) {
    allCycleLengths.push(Math.round((starts[i].getTime() - starts[i - 1].getTime()) / DAY_MS));
  }
  // Only the most recent history is used for prediction — a cycle from a
  // year ago says little about next month.
  const recentLengths = allCycleLengths.slice(-12);
  const hasEnoughHistory = recentLengths.length >= 2;

  // Median/MAD over the user's OWN recent cycles, never a population
  // formula — this replaces the old "assume 28 days, ovulate on day 14"
  // approach, which studies show mispredicts ovulation for most people.
  const medianLength = hasEnoughHistory ? median(recentLengths) : (input.profile.averageCycleLength ?? 28);
  const mad = hasEnoughHistory ? medianAbsoluteDeviation(recentLengths, medianLength) : 0;
  const cycleLength = Math.round(medianLength);
  // A prediction range is always at least ±2 days (never a falsely exact
  // single date) and never wider than ±10 (a range that big stops being
  // useful information).
  const rangeHalfWidth = hasEnoughHistory ? Math.max(2, Math.min(10, Math.round(mad))) : 3;

  const coefficientOfVariation = medianLength > 0 ? mad / medianLength : 1;
  let confidence: "low" | "medium" | "high";
  let irregularityNote: string | null = null;
  if (!hasEnoughHistory) {
    confidence = "low";
    irregularityNote = "Not enough logged cycles yet — this is a general estimate, not one based on your own pattern.";
  } else if (input.isPerimenopause) {
    confidence = "low";
    irregularityNote = "Perimenopause can make cycle timing less predictable — treat this estimate loosely.";
  } else if (coefficientOfVariation > 0.2) {
    confidence = "low";
    irregularityNote =
      "Your cycles have varied a lot recently, so this prediction is less reliable. Conditions like PCOS, thyroid changes, or perimenopause can cause irregular cycles — a clinician can help figure out what's going on for you.";
  } else if (recentLengths.length < 4) {
    confidence = "medium";
  } else {
    confidence = "high";
  }

  // Completed periods only. Every period except possibly the last one is
  // provably over already — its run ended because the next period started
  // (or today is well past its last logged day), both logged facts. The
  // last one is only excluded when its last logged day is today or
  // yesterday, since the person may simply not have logged today's
  // continuation yet.
  const lastPeriod = periods.at(-1);
  const lastPeriodPossiblyOngoing = lastPeriod
    ? Math.floor((input.today.getTime() - lastPeriod.end.getTime()) / DAY_MS) <= 1
    : false;
  const completedPeriods = lastPeriodPossiblyOngoing ? periods.slice(0, -1) : periods;
  const loggedPeriodLengths = completedPeriods.map(
    (p) => Math.round((p.end.getTime() - p.start.getTime()) / DAY_MS) + 1
  );
  const loggedPeriodLength = loggedPeriodLengths.length
    ? Math.round((loggedPeriodLengths.reduce((a, b) => a + b, 0) / loggedPeriodLengths.length) * 10) / 10
    : null;
  const periodLength = loggedPeriodLength ?? input.profile.averagePeriodLength ?? 5;

  const lastStart = starts.at(-1) ?? null;
  const currentDay = lastStart ? Math.floor((input.today.getTime() - lastStart.getTime()) / DAY_MS) + 1 : null;

  const nextPeriodDate = lastStart ? new Date(lastStart.getTime() + cycleLength * DAY_MS) : null;
  const nextPeriodRangeStart = lastStart
    ? new Date(lastStart.getTime() + Math.max(1, cycleLength - rangeHalfWidth) * DAY_MS)
    : null;
  const nextPeriodRangeEnd = lastStart
    ? new Date(lastStart.getTime() + (cycleLength + rangeHalfWidth) * DAY_MS)
    : null;

  // Ovulation estimated backward from the predicted period range (a
  // stable luteal phase) rather than forward from day 1 — then widened
  // into a fertile window using typical sperm/egg viability.
  let fertileWindowStart: Date | null = null;
  let fertileWindowEnd: Date | null = null;
  if (nextPeriodRangeStart && nextPeriodRangeEnd) {
    const ovulationRangeStart = new Date(nextPeriodRangeStart.getTime() - LUTEAL_PHASE_DAYS * DAY_MS);
    const ovulationRangeEnd = new Date(nextPeriodRangeEnd.getTime() - LUTEAL_PHASE_DAYS * DAY_MS);
    fertileWindowStart = new Date(ovulationRangeStart.getTime() - FERTILE_WINDOW_BEFORE_DAYS * DAY_MS);
    fertileWindowEnd = new Date(ovulationRangeEnd.getTime() + FERTILE_WINDOW_AFTER_DAYS * DAY_MS);
  }

  // A period is "late" once today has passed the far edge of the predicted
  // range — at that point the cycle has already run longer than the
  // prediction expected, so the phase stops being reported as "luteal"
  // indefinitely (which would otherwise happen forever) and becomes a
  // plain, calm "late" state instead. Never a diagnosis, just a label.
  const daysPastRange =
    currentDay !== null && nextPeriodRangeEnd && lastStart
      ? Math.floor((input.today.getTime() - nextPeriodRangeEnd.getTime()) / DAY_MS)
      : -1;
  const isLate = daysPastRange > 0;
  const daysLate = isLate ? currentDay! - cycleLength : 0;

  let phase: CyclePhase | null = null;
  if (currentDay !== null) {
    if (isLate) {
      phase = "late";
    } else if (currentDay <= periodLength) {
      phase = "menstrual";
    } else if (currentDay <= cycleLength / 2 - 2) {
      phase = "follicular";
    } else if (currentDay <= cycleLength / 2 + 2) {
      phase = "ovulation";
    } else {
      phase = "luteal";
    }
  }

  return {
    currentDay,
    phase,
    isLate,
    daysLate,
    cycleLength,
    periodLength,
    loggedPeriodLength,
    nextPeriodDate,
    nextPeriodRangeStart,
    nextPeriodRangeEnd,
    fertileWindowStart,
    fertileWindowEnd,
    confidence,
    irregularityNote,
    lastCycleLengths: recentLengths.slice(-6),
  };
}

export const cycleService = {
  async listEntries(userId: string, range: { from?: string; to?: string }) {
    const where: Prisma.CycleEntryWhereInput = { userId };
    if (range.from || range.to) {
      where.date = {
        gte: range.from ? new Date(range.from) : undefined,
        lte: range.to ? new Date(range.to) : undefined,
      };
    }
    return prisma.cycleEntry.findMany({ where, orderBy: { date: "asc" } });
  },

  async upsertEntry(userId: string, input: { date: string } & Record<string, unknown>) {
    const { date, ...rest } = input;
    return prisma.cycleEntry.upsert({
      where: { userId_date: { userId, date: new Date(date) } },
      create: { userId, date: new Date(date), ...rest } as Prisma.CycleEntryUncheckedCreateInput,
      update: rest as Prisma.CycleEntryUncheckedUpdateInput,
    });
  },

  async deleteEntry(userId: string, date: string) {
    const existing = await prisma.cycleEntry.findUnique({
      where: { userId_date: { userId, date: new Date(date) } },
    });
    if (!existing) throw new NotFoundError("No cycle entry found for that date.");
    await prisma.cycleEntry.delete({ where: { id: existing.id } });
  },

  async getProfile(userId: string) {
    const profile = await prisma.cycleProfile.findUnique({ where: { userId } });
    return profile ?? { userId, averageCycleLength: 28, averagePeriodLength: 5 };
  },

  async upsertProfile(
    userId: string,
    input: { averageCycleLength: number; averagePeriodLength: number }
  ) {
    return prisma.cycleProfile.upsert({
      where: { userId },
      create: { userId, ...input },
      update: input,
    });
  },

  /**
   * Derives a lightweight cycle summary from logged period-start dates —
   * this is a descriptive trend calculation, never a predictive medical
   * claim (SRS §12: not a diagnostic system).
   *
   * `todayOverride` lets the caller (the browser, via `?today=`) supply its
   * own local calendar date instead of the server's UTC clock — otherwise a
   * user meaningfully ahead of UTC (e.g. India, UTC+5:30) can have their
   * local day already advanced past what the server's `new Date()` still
   * reports, undercounting `currentDay` by one for part of the day. Callers
   * with no client in the loop (PDF report generation, the mood-factor
   * cycle-phase check) have no local date to pass and fall back to the
   * server clock — that residual gap can't be closed without storing the
   * user's timezone, which is out of scope here.
   */
  async getSummary(userId: string, todayOverride?: string) {
    const [user, profile, periodEntries, history] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { lifeStage: true } }),
      cycleService.getProfile(userId),
      prisma.cycleEntry.findMany({
        where: { userId, isPeriod: true },
        select: { date: true, flow: true },
        orderBy: { date: "desc" },
        take: 400,
      }),
      prisma.cycleEntry.findMany({
        where: { userId },
        orderBy: { date: "desc" },
        take: 90,
      }),
    ]);

    const today = todayOverride ? new Date(todayOverride) : new Date();
    const result = computeCycleSummary({
      periodDays: periodEntries,
      today,
      profile,
      isPerimenopause: user?.lifeStage === "PERIMENOPAUSE",
    });

    return { ...result, history };
  },
};
