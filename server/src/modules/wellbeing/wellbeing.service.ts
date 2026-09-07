import { prisma } from "@/lib/prisma";

export const wellbeingService = {
  async listRecent(userId: string, days = 14) {
    const since = new Date(Date.now() - days * 86_400_000);
    return prisma.wellbeingEntry.findMany({
      where: { userId, date: { gte: since } },
      orderBy: { date: "asc" },
    });
  },

  async upsertEntry(userId: string, input: {
    date: string; mood: number; stress: number; energy: number; note?: string;
  }) {
    const { date, ...rest } = input;
    return prisma.wellbeingEntry.upsert({
      where: { userId_date: { userId, date: new Date(date) } },
      create: { userId, date: new Date(date), ...rest },
      update: rest,
    });
  },
};
