import { prisma } from "@/lib/prisma";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

export const reportsService = {
  async list(userId: string) {
    return prisma.report.findMany({
      where: { userId },
      orderBy: { generatedOn: "desc" },
      select: { id: true, title: true, rangeLabel: true, generatedOn: true },
    });
  },

  async get(userId: string, id: string) {
    const report = await prisma.report.findUnique({ where: { id } });
    if (!report) throw new NotFoundError("Report not found.");
    if (report.userId !== userId) throw new ForbiddenError();
    return report;
  },

  /**
   * Snapshots the user's own recently-logged records into a single
   * report document — a summary of tracked data, not a clinical
   * interpretation (SRS §12.2).
   */
  async generate(userId: string, input: { title: string; rangeLabel: string; rangeDays: number }) {
    const since = new Date(Date.now() - input.rangeDays * 86_400_000);

    const [cycle, sleep, activity, wellbeing, goals, vitals] = await Promise.all([
      prisma.cycleEntry.findMany({ where: { userId, date: { gte: since } } }),
      prisma.sleepEntry.findMany({ where: { userId, date: { gte: since } } }),
      prisma.activityEntry.findMany({ where: { userId, date: { gte: since } } }),
      prisma.wellbeingEntry.findMany({ where: { userId, date: { gte: since } } }),
      prisma.goal.findMany({ where: { userId } }),
      prisma.vitalMeasurement.findMany({ where: { userId, date: { gte: since } } }),
    ]);

    const dataSnapshot = {
      rangeDays: input.rangeDays,
      cycleEntryCount: cycle.length,
      sleep: { entryCount: sleep.length, avgHours: avg(sleep.map((s) => s.durationHours)) },
      activity: { entryCount: activity.length, totalMinutes: sum(activity.map((a) => a.durationMinutes)) },
      wellbeing: { entryCount: wellbeing.length, avgMood: avg(wellbeing.map((w) => w.mood)) },
      goalsInProgress: goals.filter((g) => !g.completed).length,
      goalsCompleted: goals.filter((g) => g.completed).length,
      vitals: vitals.map((v) => ({ type: v.type, value: v.value, date: v.date })),
    };

    return prisma.report.create({
      data: { userId, title: input.title, rangeLabel: input.rangeLabel, dataSnapshot },
    });
  },
};

function avg(xs: number[]) {
  return xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : 0;
}
function sum(xs: number[]) {
  return xs.reduce((a, b) => a + b, 0);
}
