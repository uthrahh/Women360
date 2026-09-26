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
   */
  async getSummary(userId: string) {
    const [user, profile, recentPeriodStarts, history] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { lifeStage: true } }),
      cycleService.getProfile(userId),
      prisma.cycleEntry.findMany({
        where: { userId, isPeriod: true },
        orderBy: { date: "desc" },
        take: 200,
      }),
      prisma.cycleEntry.findMany({
        where: { userId },
        orderBy: { date: "desc" },
        take: 90,
      }),
    ]);

    // Group consecutive isPeriod days into distinct period "starts".
    const starts: Date[] = [];
    let prev: Date | null = null;
    for (const entry of [...recentPeriodStarts].sort((a, b) => a.date.getTime() - b.date.getTime())) {
      if (!prev || entry.date.getTime() - prev.getTime() > DAY_MS) {
        starts.push(entry.date);
      }
      prev = entry.date;
    }

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
    const medianLength = hasEnoughHistory ? median(recentLengths) : (profile.averageCycleLength ?? 28);
    const mad = hasEnoughHistory ? medianAbsoluteDeviation(recentLengths, medianLength) : 0;
    const cycleLength = Math.round(medianLength);
    // A prediction range is always at least ±2 days (never a falsely exact
    // single date) and never wider than ±10 (a range that big stops being
    // useful information).
    const rangeHalfWidth = hasEnoughHistory ? Math.max(2, Math.min(10, Math.round(mad))) : 3;

    const coefficientOfVariation = medianLength > 0 ? mad / medianLength : 1;
    const isPerimenopause = user?.lifeStage === "PERIMENOPAUSE";
    let confidence: "low" | "medium" | "high";
    let irregularityNote: string | null = null;
    if (!hasEnoughHistory) {
      confidence = "low";
      irregularityNote = "Not enough logged cycles yet — this is a general estimate, not one based on your own pattern.";
    } else if (isPerimenopause) {
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

    const lastStart = starts.at(-1) ?? null;
    const today = new Date();
    const currentDay = lastStart
      ? Math.floor((today.getTime() - lastStart.getTime()) / DAY_MS) + 1
      : null;

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

    let phase: "menstrual" | "follicular" | "ovulation" | "luteal" | null = null;
    if (currentDay !== null) {
      const periodLength = profile.averagePeriodLength ?? 5;
      if (currentDay <= periodLength) phase = "menstrual";
      else if (currentDay <= cycleLength / 2 - 2) phase = "follicular";
      else if (currentDay <= cycleLength / 2 + 2) phase = "ovulation";
      else phase = "luteal";
    }

    return {
      currentDay,
      phase,
      cycleLength,
      periodLength: profile.averagePeriodLength,
      nextPeriodDate,
      nextPeriodRangeStart,
      nextPeriodRangeEnd,
      fertileWindowStart,
      fertileWindowEnd,
      confidence,
      irregularityNote,
      lastCycleLengths: recentLengths.slice(-6),
      history,
    };
  },
};
