import { prisma } from "@/lib/prisma";

/**
 * Read-only, descriptive trend summaries — SRS §12/BR-03/BR-04: dashboard
 * trends must be based on available historical records and clearly
 * distinguish tracked data from inferred observations, and must never
 * present an autonomous diagnosis. Every card here reports a correlation
 * in the user's own logged data, phrased as an observation, not advice.
 */
export const insightsService = {
  async getInsights(userId: string) {
    const since = new Date(Date.now() - 14 * 86_400_000);
    const [sleepEntries, wellbeingEntries, activityEntries, hydrationLogs, nutritionGoal, cycleEntries] =
      await Promise.all([
        prisma.sleepEntry.findMany({ where: { userId, date: { gte: since } }, orderBy: { date: "asc" } }),
        prisma.wellbeingEntry.findMany({ where: { userId, date: { gte: since } }, orderBy: { date: "asc" } }),
        prisma.activityEntry.findMany({ where: { userId, date: { gte: since } } }),
        prisma.hydrationLog.findMany({ where: { userId, date: { gte: since } } }),
        prisma.nutritionGoal.findUnique({ where: { userId } }),
        prisma.cycleEntry.findMany({ where: { userId, date: { gte: since } } }),
      ]);

    const byDate = <T extends { date: Date }>(rows: T[]) => {
      const map = new Map<string, T>();
      for (const r of rows) map.set(r.date.toISOString().slice(0, 10), r);
      return map;
    };
    const wellbeingByDate = byDate(wellbeingEntries);

    const sleepMood = sleepEntries
      .map((s) => {
        const w = wellbeingByDate.get(s.date.toISOString().slice(0, 10));
        return w ? { sleep: s.durationHours, mood: w.mood } : null;
      })
      .filter((x): x is { sleep: number; mood: number } => x !== null);

    const cards: { q: string; a: string }[] = [];

    if (sleepMood.length >= 3) {
      const wellSlept = sleepMood.filter((x) => x.sleep >= 7);
      const underSlept = sleepMood.filter((x) => x.sleep < 7);
      if (wellSlept.length && underSlept.length) {
        const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
        const diff = avg(wellSlept.map((x) => x.mood)) - avg(underSlept.map((x) => x.mood));
        cards.push({
          q: "Does sleep affect your mood?",
          a:
            diff > 0.3
              ? "On nights you slept 7+ hours, your logged mood the next day was noticeably higher."
              : "No clear difference in logged mood between longer and shorter sleep nights recently.",
        });
      }
    }

    if (activityEntries.length > 0) {
      const activeDays = new Set(activityEntries.filter((e) => e.durationMinutes >= 30).map((e) => e.date.toISOString().slice(0, 10)));
      const energyOnActiveDays = wellbeingEntries.filter((w) => activeDays.has(w.date.toISOString().slice(0, 10)));
      if (energyOnActiveDays.length > 0) {
        const avgEnergy = energyOnActiveDays.reduce((a, w) => a + w.energy, 0) / energyOnActiveDays.length;
        cards.push({
          q: "How does activity relate to energy?",
          a: `On days with 30+ active minutes, your logged energy averaged ${avgEnergy.toFixed(1)} of 4.`,
        });
      }
    }

    if (cycleEntries.length > 0) {
      const painValues = cycleEntries.filter((c) => c.pain !== null).map((c) => c.pain as number);
      if (painValues.length >= 2) {
        const trend = painValues.at(-1)! - painValues[0];
        cards.push({
          q: "Any changes in your cycle symptoms?",
          a:
            Math.abs(trend) <= 1
              ? "Cramping intensity has been steady across your recent entries — no notable shift."
              : trend > 0
                ? "Logged cramping intensity has trended up across your recent entries."
                : "Logged cramping intensity has trended down across your recent entries.",
        });
      }
    }

    if (nutritionGoal && hydrationLogs.length > 0) {
      const byDay = new Map<string, number>();
      for (const h of hydrationLogs) {
        const key = h.date.toISOString().slice(0, 10);
        byDay.set(key, (byDay.get(key) ?? 0) + h.amountMl);
      }
      const daysHittingGoal = [...byDay.values()].filter((ml) => ml >= nutritionGoal.hydrationGoalMl).length;
      cards.push({
        q: "Are you meeting your hydration goal?",
        a: `You've hit your hydration goal on ${daysHittingGoal} of the last ${byDay.size} logged days.`,
      });
    }

    return { sleepMood, cards };
  },
};
