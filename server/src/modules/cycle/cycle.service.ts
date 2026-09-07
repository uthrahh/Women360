import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/lib/errors";
import type { Prisma } from "@prisma/client";

const DAY_MS = 86_400_000;

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
    const [profile, recentPeriodStarts, history] = await Promise.all([
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

    const lastCycleLengths: number[] = [];
    for (let i = 1; i < starts.length; i++) {
      lastCycleLengths.push(Math.round((starts[i].getTime() - starts[i - 1].getTime()) / DAY_MS));
    }

    const lastStart = starts.at(-1) ?? null;
    const cycleLength =
      lastCycleLengths.at(-1) ?? profile.averageCycleLength ?? 28;
    const today = new Date();
    const currentDay = lastStart
      ? Math.floor((today.getTime() - lastStart.getTime()) / DAY_MS) + 1
      : null;
    const nextPeriodDate = lastStart
      ? new Date(lastStart.getTime() + cycleLength * DAY_MS)
      : null;

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
      lastCycleLengths: lastCycleLengths.slice(-6),
      history,
    };
  },
};
