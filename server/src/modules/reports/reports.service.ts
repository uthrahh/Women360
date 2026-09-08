import { prisma } from "@/lib/prisma";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { cycleService } from "@/modules/cycle/cycle.service";
import { goalsService } from "@/modules/goals/goals.service";

function avg(xs: number[]): number | null {
  return xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null;
}
function sum(xs: number[]) {
  return xs.reduce((a, b) => a + b, 0);
}

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
   * Snapshots the user's own recently-logged records into a single report
   * document — a summary of tracked data, not a clinical interpretation
   * (SRS §12.2). Every figure here is computed directly from the same
   * tables the live pages read from (no separately-maintained totals), so
   * the report can never drift from what the app itself shows.
   */
  async generate(userId: string, input: { title: string; rangeLabel: string; rangeDays: number }) {
    const since = new Date(Date.now() - input.rangeDays * 86_400_000);

    const [
      user,
      meals,
      hydrationLogs,
      fruitVegLogs,
      sleepEntries,
      activity,
      wellbeing,
      vitals,
      cycleSummary,
      goals,
    ] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, lifeStage: true } }),
      prisma.mealEntry.findMany({ where: { userId, date: { gte: since } } }),
      prisma.hydrationLog.findMany({ where: { userId, date: { gte: since } } }),
      prisma.fruitVegLog.findMany({ where: { userId, date: { gte: since } } }),
      prisma.sleepEntry.findMany({ where: { userId, date: { gte: since } }, orderBy: { date: "asc" } }),
      prisma.activityEntry.findMany({ where: { userId, date: { gte: since } } }),
      prisma.wellbeingEntry.findMany({ where: { userId, date: { gte: since } } }),
      prisma.vitalMeasurement.findMany({ where: { userId, date: { gte: since } }, orderBy: { date: "desc" } }),
      cycleService.getSummary(userId),
      goalsService.list(userId),
    ]);

    // Group meals/hydration by calendar day so "average per day" reflects
    // days actually logged, not the full period length (a person who
    // logged 3 days out of 30 shouldn't look like they ate 1/10th as much).
    const daysWithMeals = new Set(meals.map((m) => m.date.toISOString().slice(0, 10))).size;
    const daysWithHydration = new Set(hydrationLogs.map((h) => h.date.toISOString().slice(0, 10))).size;

    const nutrition = {
      daysLogged: daysWithMeals,
      totalMealsLogged: meals.length,
      avgCaloriesPerLoggedDay: daysWithMeals ? avg(distributeByDay(meals, (m) => m.calories)) : null,
      avgProteinGPerLoggedDay: daysWithMeals ? avg(distributeByDay(meals, (m) => m.proteinG)) : null,
      avgFibreGPerLoggedDay: daysWithMeals ? avg(distributeByDay(meals, (m) => m.fibreG)) : null,
      avgCarbsGPerLoggedDay: daysWithMeals ? avg(distributeByDay(meals, (m) => m.carbsG ?? 0)) : null,
      avgFatGPerLoggedDay: daysWithMeals ? avg(distributeByDay(meals, (m) => m.fatG ?? 0)) : null,
      avgHydrationMlPerLoggedDay: daysWithHydration ? avg(distributeByDay(hydrationLogs, (h) => h.amountMl)) : null,
      totalFruitVegServings: sum(fruitVegLogs.map((f) => f.servings)),
    };

    // Sleep quality is a 1-5 rating (1 Very poor .. 5 Excellent), never a
    // percentage — averaged and reported as-is, one decimal place.
    const sleep = {
      entryCount: sleepEntries.length,
      avgDurationHours: avg(sleepEntries.map((s) => s.durationHours)),
      avgQuality: avg(sleepEntries.map((s) => s.quality)),
    };

    const activitySummary = {
      entryCount: activity.length,
      totalMinutes: sum(activity.map((a) => a.durationMinutes)),
    };

    const wellbeingSummary = {
      entryCount: wellbeing.length,
      avgMood: avg(wellbeing.map((w) => w.mood)),
      avgStress: avg(wellbeing.map((w) => w.stress)),
      avgEnergy: avg(wellbeing.map((w) => w.energy)),
    };

    // Cycle predictions are always estimates derived from logged period
    // starts, never presented as certain — the UI carries that framing;
    // the report snapshot just records the same numbers the Cycle page
    // itself shows so the two can never disagree.
    const cycle = {
      hasData: cycleSummary.currentDay !== null,
      currentDay: cycleSummary.currentDay,
      phase: cycleSummary.phase,
      averageCycleLengthDays: cycleSummary.cycleLength,
      averagePeriodLengthDays: cycleSummary.periodLength,
      estimatedNextPeriodDate: cycleSummary.nextPeriodDate,
    };

    const goalsSummary = {
      active: goals
        .filter((g) => !g.completed)
        .map((g) => ({
          title: g.title,
          category: g.category,
          currentValue: g.currentValue,
          targetValue: g.targetValue,
          unit: g.unit,
          progressPct: g.targetValue > 0 ? Math.max(0, Math.min(100, Math.round((g.currentValue / g.targetValue) * 100))) : 0,
        })),
      completed: goals.filter((g) => g.completed).map((g) => ({ title: g.title, category: g.category })),
    };

    const dataSnapshot = {
      rangeDays: input.rangeDays,
      profile: { name: user.name, lifeStage: user.lifeStage },
      nutrition,
      sleep,
      activity: activitySummary,
      wellbeing: wellbeingSummary,
      cycle,
      goals: goalsSummary,
      vitals: vitals.map((v) => ({ type: v.type, value: v.value, date: v.date })),
    };

    return prisma.report.create({
      data: { userId, title: input.title, rangeLabel: input.rangeLabel, dataSnapshot },
    });
  },
};

// Sums a numeric field per calendar day, returning one total per day that
// actually has at least one row (days with zero rows are excluded, not
// counted as a real recorded zero).
function distributeByDay<T>(rows: (T & { date: Date })[], pick: (row: T) => number): number[] {
  const byDay = new Map<string, number>();
  for (const row of rows) {
    const key = row.date.toISOString().slice(0, 10);
    byDay.set(key, (byDay.get(key) ?? 0) + pick(row));
  }
  return [...byDay.values()];
}
