import { prisma } from "@/lib/prisma";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const activityService = {
  async getSummary(userId: string) {
    const since = new Date(Date.now() - 7 * 86_400_000);
    const [goal, todaySteps, entries, weekSteps] = await Promise.all([
      prisma.activityGoal.findUnique({ where: { userId } }),
      prisma.stepsLog.findFirst({
        where: { userId, date: new Date(new Date().toISOString().slice(0, 10)) },
      }),
      prisma.activityEntry.findMany({ where: { userId }, orderBy: { date: "desc" }, take: 20 }),
      prisma.activityEntry.findMany({ where: { userId, date: { gte: since } } }),
    ]);

    const activeMinutes = weekSteps
      .filter((e) => e.date.toDateString() === new Date().toDateString())
      .reduce((sum, e) => sum + e.durationMinutes, 0);

    const byDay = new Map<string, number>();
    for (const e of weekSteps) {
      const key = DAY_NAMES[e.date.getUTCDay()];
      byDay.set(key, (byDay.get(key) ?? 0) + e.durationMinutes);
    }

    return {
      steps: todaySteps?.steps ?? 0,
      stepsGoal: goal?.stepsGoal ?? 8000,
      activeMinutes,
      activeMinutesGoal: goal?.activeMinutesGoal ?? 45,
      weeklyMinutes: DAY_NAMES.map((day) => ({ day, minutes: byDay.get(day) ?? 0 })),
      entries,
    };
  },

  async addEntry(userId: string, input: {
    date: string; type: string; durationMinutes: number; intensity: "LOW" | "MODERATE" | "HIGH"; notes?: string;
  }) {
    return prisma.activityEntry.create({ data: { userId, ...input, date: new Date(input.date) } });
  },

  async deleteEntry(userId: string, id: string) {
    const entry = await prisma.activityEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundError("Activity entry not found.");
    if (entry.userId !== userId) throw new ForbiddenError();
    await prisma.activityEntry.delete({ where: { id } });
  },

  async logSteps(userId: string, input: { date: string; steps: number }) {
    return prisma.stepsLog.upsert({
      where: { userId_date: { userId, date: new Date(input.date) } },
      create: { userId, date: new Date(input.date), steps: input.steps },
      update: { steps: input.steps },
    });
  },

  async upsertGoal(userId: string, input: { stepsGoal: number; activeMinutesGoal: number }) {
    return prisma.activityGoal.upsert({
      where: { userId },
      create: { userId, ...input },
      update: input,
    });
  },
};
