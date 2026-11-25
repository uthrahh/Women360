import { prisma } from "@/lib/prisma";
import { BADGES, POINTS, basePoints, emptyDay, isActive, levelFor, pointsForLevel, questPoints, questsFor, runOf, type DayLog, type Totals } from "./rules";

/** How far back points are counted. A long history is summed once per request, so it is bounded. */
const HISTORY_DAYS = 400;
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Every day she logged something in the window, with what she logged. Read from her own log tables; nothing extra is stored. */
async function daysOf(userId: string, today: string): Promise<{ days: Map<string, DayLog>; has: { cycle: boolean; habits: boolean; medicines: boolean } }> {
  const from = new Date(Date.parse(today + "T00:00:00Z") - HISTORY_DAYS * 86_400_000);
  const where = { userId, date: { gte: from } };
  const [user, habits, habitLogs, meals, water, fruit, sleep, mood, activity, cycle, meds, steps, tasks, medicineCount] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { cycleTracking: true } }),
    prisma.habit.count({ where: { userId, archivedAt: null } }),
    prisma.habitLog.findMany({ where: { habit: { userId }, date: { gte: from } }, select: { date: true, amount: true, habit: { select: { target: true } } } }),
    prisma.mealEntry.groupBy({ by: ["date"], where, _count: true }),
    prisma.hydrationLog.groupBy({ by: ["date"], where, _count: true }),
    prisma.fruitVegLog.groupBy({ by: ["date"], where, _count: true }),
    prisma.sleepEntry.groupBy({ by: ["date"], where, _count: true }),
    prisma.wellbeingEntry.groupBy({ by: ["date"], where, _count: true }),
    prisma.activityEntry.groupBy({ by: ["date"], where, _count: true }),
    prisma.cycleEntry.groupBy({ by: ["date"], where, _count: true }),
    prisma.medicationLog.findMany({ where: { userId, status: "TAKEN", scheduledFor: { gte: from } }, select: { scheduledFor: true } }),
    prisma.stepsLog.groupBy({ by: ["date"], where, _count: true }),
    prisma.taskEvent.findMany({ where: { type: "DONE", actorRole: "WOMAN", date: { gte: from }, task: { enrolment: { userId } } }, select: { taskId: true, date: true } }),
    prisma.medication.count({ where: { userId } }),
  ]);

  const days = new Map<string, DayLog>();
  const day = (d: Date | string) => {
    const k = typeof d === "string" ? d : iso(d);
    if (!days.has(k)) days.set(k, emptyDay(k));
    return days.get(k)!;
  };
  // An amount habit counts once its amount reaches the target; a tick habit counts when ticked.
  for (const l of habitLogs) if (l.habit.target === null || (l.amount ?? 0) >= l.habit.target) day(l.date).habitsDone++;
  for (const g of meals) day(g.date).meals += g._count;
  for (const g of water) day(g.date).water = true;
  for (const g of fruit) day(g.date).fruitVeg = true;
  for (const g of sleep) day(g.date).sleep = true;
  for (const g of mood) day(g.date).mood = true;
  for (const g of activity) day(g.date).movement += g._count;
  if (user.cycleTracking) for (const g of cycle) day(g.date).cycle = true;
  for (const m of meds) day(m.scheduledFor).medicinesTaken++;
  for (const g of steps) day(g.date).steps = true;
  // A task done, undone and done again is one task: count distinct task-days.
  for (const k of new Set(tasks.map((t) => t.taskId + "|" + iso(t.date)))) day(k.split("|")[1]).programmeTasks++;

  return { days, has: { cycle: user.cycleTracking, habits: habits > 0, medicines: medicineCount > 0 } };
}

export const gameService = {
  async state(userId: string, today: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { gameMode: true, gameLevelSeen: true } });
    if (!user.gameMode) return { enabled: false as const };

    const { days, has } = await daysOf(userId, today);
    let xp = 0;
    const totals: Totals = { activeDays: 0, habitsDone: 0, sleepDays: 0, waterDays: 0, moodDays: 0, movementDays: 0, allRoundDays: 0, programmeTasks: 0, bestRun: 0, level: 1 };
    const active = new Set<string>();
    for (const [date, d] of days) {
      if (date > today) continue;
      xp += basePoints(d) + questPoints(d, questsFor(date, has));
      if (isActive(d)) {
        active.add(date);
        totals.activeDays++;
      }
      totals.habitsDone += d.habitsDone;
      totals.programmeTasks += d.programmeTasks;
      if (d.sleep) totals.sleepDays++;
      if (d.water) totals.waterDays++;
      if (d.mood) totals.moodDays++;
      if (d.movement > 0) totals.movementDays++;
      if (d.sleep && d.meals > 0 && d.movement > 0 && d.mood) totals.allRoundDays++;
    }
    const run = runOf(active, today);
    const level = levelFor(xp);
    Object.assign(totals, { bestRun: run.best, level });

    const todayLog = days.get(today) ?? emptyDay(today);
    const quests = questsFor(today, has);
    return {
      enabled: true as const,
      xp,
      level,
      levelFrom: pointsForLevel(level),
      levelTo: pointsForLevel(level + 1),
      // Congratulate once per new level, not on every visit.
      newLevel: level > user.gameLevelSeen ? level : null,
      today: { points: basePoints(todayLog) + questPoints(todayLog, quests), quests: quests.map((q) => ({ id: q.id, label: q.label, done: q.done(todayLog) })) },
      run,
      badges: BADGES.map((b) => ({ id: b.id, label: b.label, description: b.description, earned: b.earned(totals) })),
      rules: POINTS.map((p) => ({ label: p.label, points: p.points, perDay: p.perDay })),
    };
  },

  async seen(userId: string, level: number) {
    await prisma.user.update({ where: { id: userId }, data: { gameLevelSeen: level } });
    return { ok: true };
  },
};
