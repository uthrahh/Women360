import { prisma } from "@/lib/prisma";
import { BadRequestError, NotFoundError } from "@/lib/errors";
import { dayNumber } from "@/lib/streak";
import { clockMinutes, sleepDurationHours } from "./duration";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function consistencyScore(entries: { bedtime: string }[]): number {
  if (entries.length < 2) return 100;
  const minutes = entries.map((e) => clockMinutes(e.bedtime) ?? 0);
  const mean = minutes.reduce((a, b) => a + b, 0) / minutes.length;
  const variance = minutes.reduce((sum, m) => sum + (m - mean) ** 2, 0) / minutes.length;
  const stdDevMinutes = Math.sqrt(variance);
  return Math.max(0, Math.round(100 - stdDevMinutes / 2));
}

export const sleepService = {
  async getSummary(userId: string) {
    const since = new Date(Date.now() - 7 * 86_400_000);
    const entries = await prisma.sleepEntry.findMany({
      where: { userId, date: { gte: since } },
      orderBy: { date: "asc" },
    });
    const latest = entries.at(-1);

    return {
      durationHours: latest?.durationHours ?? 0,
      quality: latest?.quality ?? 0,
      bedtime: latest?.bedtime ?? "",
      wakeTime: latest?.wakeTime ?? "",
      consistencyScore: consistencyScore(entries),
      weeklyHours: entries.map((e) => ({ day: DAY_NAMES[e.date.getUTCDay()], hours: e.durationHours })),
      history: [...entries].reverse(),
    };
  },

  async upsertEntry(userId: string, input: {
    date: string; bedDate?: string; durationHours: number; quality: number; bedtime: string; wakeTime: string; notes?: string;
  }) {
    const { date, bedDate, ...rest } = input;
    let durationHours = rest.durationHours;
    if (bedDate) {
      // She told us both days, so the length comes from them, not from a number the client sent.
      if (dayNumber(bedDate) > dayNumber(date)) throw new BadRequestError("You can't go to bed after you wake up.");
      const worked = sleepDurationHours(bedDate, rest.bedtime, date, rest.wakeTime);
      if (worked === null) throw new BadRequestError("Wake-up has to be after bedtime, and no more than 24 hours later.");
      durationHours = worked;
    }
    const data = { ...rest, durationHours, bedDate: bedDate ? new Date(bedDate) : null };
    return prisma.sleepEntry.upsert({
      where: { userId_date: { userId, date: new Date(date) } },
      create: { userId, date: new Date(date), ...data },
      update: data,
    });
  },

  async deleteEntry(userId: string, date: string) {
    const existing = await prisma.sleepEntry.findUnique({
      where: { userId_date: { userId, date: new Date(date) } },
    });
    if (!existing) throw new NotFoundError("No sleep entry found for that date.");
    await prisma.sleepEntry.delete({ where: { id: existing.id } });
  },
};
