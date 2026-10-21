import { prisma } from "@/lib/prisma";
import { BadRequestError, ForbiddenError, NotFoundError } from "@/lib/errors";
import type { Intensity } from "@prisma/client";

const MAX_QUICK_LOG = 20;

// Copied into a person's own list the first time she opens it. After that the
// list is hers: she can remove any of these and add her own.
const DEFAULT_QUICK_LOG: { label: string; type: string; durationMinutes: number; intensity: Intensity }[] = [
  { label: "15-min walk", type: "Walk", durationMinutes: 15, intensity: "LOW" },
  { label: "30-min brisk walk", type: "Brisk walk", durationMinutes: 30, intensity: "MODERATE" },
  { label: "20-min strength (bodyweight)", type: "Strength (bodyweight)", durationMinutes: 20, intensity: "MODERATE" },
  { label: "10-min stretch / mobility", type: "Stretch / mobility", durationMinutes: 10, intensity: "LOW" },
  { label: "30-min cycling", type: "Cycling", durationMinutes: 30, intensity: "MODERATE" },
  { label: "20-min yoga", type: "Yoga", durationMinutes: 20, intensity: "LOW" },
];

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

  async updateEntry(
    userId: string,
    id: string,
    input: { date?: string; type?: string; durationMinutes?: number; intensity?: "LOW" | "MODERATE" | "HIGH"; notes?: string }
  ) {
    const entry = await prisma.activityEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundError("Activity entry not found.");
    if (entry.userId !== userId) throw new ForbiddenError();
    const { date, ...rest } = input;
    return prisma.activityEntry.update({ where: { id }, data: { ...rest, ...(date ? { date: new Date(date) } : {}) } });
  },

  async listQuickLog(userId: string) {
    // The flag flips exactly once, so two tabs opening at the same moment can't both copy the defaults.
    const claimed = await prisma.user.updateMany({ where: { id: userId, activityQuickLogSeeded: false }, data: { activityQuickLogSeeded: true } });
    if (claimed.count === 1) {
      await prisma.activityQuickLog.createMany({ data: DEFAULT_QUICK_LOG.map((d) => ({ userId, ...d })) });
    }
    return prisma.activityQuickLog.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
  },

  async addQuickLog(userId: string, input: { label: string; type: string; durationMinutes: number; intensity: Intensity }) {
    await activityService.listQuickLog(userId); // make sure defaults were copied before she adds her own
    const count = await prisma.activityQuickLog.count({ where: { userId } });
    if (count >= MAX_QUICK_LOG) throw new BadRequestError(`Your quick log is full (${MAX_QUICK_LOG}). Remove one to add another.`);
    return prisma.activityQuickLog.create({ data: { userId, ...input } });
  },

  async removeQuickLog(userId: string, id: string) {
    const item = await prisma.activityQuickLog.findUnique({ where: { id } });
    if (!item) throw new NotFoundError("Quick log item not found.");
    if (item.userId !== userId) throw new ForbiddenError();
    await prisma.activityQuickLog.delete({ where: { id } });
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
