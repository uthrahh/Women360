import { prisma } from "@/lib/prisma";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function consistencyScore(entries: { bedtime: string }[]): number {
  if (entries.length < 2) return 100;
  const toMinutes = (t: string) => {
    const match = /(\d+):(\d+)\s*(AM|PM)?/i.exec(t);
    if (!match) return 0;
    let h = Number(match[1]) % 12;
    if (match[3]?.toUpperCase() === "PM") h += 12;
    return h * 60 + Number(match[2]);
  };
  const minutes = entries.map((e) => toMinutes(e.bedtime));
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
    };
  },

  async upsertEntry(userId: string, input: {
    date: string; durationHours: number; quality: number; bedtime: string; wakeTime: string;
  }) {
    const { date, ...rest } = input;
    return prisma.sleepEntry.upsert({
      where: { userId_date: { userId, date: new Date(date) } },
      create: { userId, date: new Date(date), ...rest },
      update: rest,
    });
  },
};
