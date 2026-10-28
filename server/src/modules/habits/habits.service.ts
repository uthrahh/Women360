import type { Habit, HabitLog } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BadRequestError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { assertPlausibleDay } from "@/lib/days";
import { computeStreak, computeWeekStreak, dayNumber, toIsoDay } from "@/lib/streak";

const MAX_ACTIVE_HABITS = 30;
// Enough history to count streaks and a week of dots; older logs aren't loaded.
const HISTORY_DAYS = 400;

const asDate = (day: string) => new Date(`${day}T00:00:00.000Z`);

interface HabitInput {
  title?: string;
  target?: number | null;
  unit?: string | null;
  daysPerWeek?: number;
  reminder?: string | null;
  activityCode?: string | null;
}

/** A day counts when something was logged and, if the habit has a target, the amount reached it. */
function isDone(habit: Pick<Habit, "target">, log: Pick<HabitLog, "amount">): boolean {
  return habit.target == null || (log.amount ?? 0) >= habit.target;
}

function present(habit: Habit & { logs: HabitLog[] }, today: string) {
  const { logs, ...rest } = habit;
  const doneDays = logs.filter((l) => isDone(habit, l)).map((l) => toIsoDay(l.date));
  const doneSet = new Set(doneDays);
  const todayLog = logs.find((l) => toIsoDay(l.date) === today);

  const everyDay = habit.daysPerWeek >= 7;
  const week = computeWeekStreak(doneDays, today, habit.daysPerWeek);
  const days = computeStreak(doneDays, today);
  const todayNumber = dayNumber(today);

  return {
    ...rest,
    doneToday: doneSet.has(today),
    amountToday: todayLog?.amount ?? null,
    streak: everyDay ? days.streak : week.streak,
    streakUnit: everyDay ? ("day" as const) : ("week" as const),
    // Days done so far in the current Mon-Sun week, for "3 of 4 this week".
    thisWeek: week.thisWeek,
    // The last seven days, oldest first, ending today.
    last7: Array.from({ length: 7 }, (_, i) => {
      const d = new Date((todayNumber - (6 - i)) * 86_400_000);
      return doneSet.has(toIsoDay(d));
    }),
  };
}

async function assertOwner(userId: string, id: string) {
  const habit = await prisma.habit.findUnique({ where: { id } });
  if (!habit) throw new NotFoundError("Habit not found.");
  if (habit.userId !== userId) throw new ForbiddenError();
  return habit;
}

const withLogs = () => {
  const since = new Date(Date.now() - HISTORY_DAYS * 86_400_000);
  return { logs: { where: { date: { gte: since } }, orderBy: { date: "desc" as const } } };
};

export const habitsService = {
  async list(userId: string, today = toIsoDay(new Date())) {
    const habits = await prisma.habit.findMany({
      where: { userId, archivedAt: null },
      orderBy: { createdAt: "asc" },
      include: withLogs(),
    });
    return habits.map((h) => present(h, today));
  },

  async create(userId: string, input: Required<Pick<HabitInput, "title" | "daysPerWeek">> & HabitInput, today = toIsoDay(new Date())) {
    const active = await prisma.habit.count({ where: { userId, archivedAt: null } });
    if (active >= MAX_ACTIVE_HABITS) throw new BadRequestError("That's a lot of habits. Archive one before adding another.");
    const habit = await prisma.habit.create({
      data: { userId, ...input, unit: input.target == null ? null : (input.unit ?? null) },
      include: withLogs(),
    });
    return present(habit, today);
  },

  async update(userId: string, id: string, input: HabitInput & { archived?: boolean }, today = toIsoDay(new Date())) {
    const existing = await assertOwner(userId, id);
    const { archived, ...rest } = input;
    const target = rest.target === undefined ? existing.target : rest.target;
    const habit = await prisma.habit.update({
      where: { id },
      data: {
        ...rest,
        // A habit with no target has no unit.
        ...(target == null ? { unit: null } : {}),
        ...(archived === undefined ? {} : { archivedAt: archived ? new Date() : null }),
      },
      include: withLogs(),
    });
    return present(habit, today);
  },

  async remove(userId: string, id: string) {
    await assertOwner(userId, id);
    await prisma.habit.delete({ where: { id } });
  },

  /**
   * Idempotent: logging the same day again just updates the amount. With no
   * amount given, a habit that has a target is logged AT the target (one tap =
   * done); one without a target stores no amount.
   */
  // `today` is the person's own current day: the habit is shown as of today even when the day being logged is an earlier one.
  async log(userId: string, id: string, day: string, amount: number | undefined, today: string = day) {
    const habit = await assertOwner(userId, id);
    assertPlausibleDay(day);
    const stored = habit.target == null ? null : (amount ?? habit.target);
    const date = asDate(day);
    await prisma.habitLog.upsert({
      where: { habitId_date: { habitId: id, date } },
      create: { habitId: id, date, amount: stored },
      update: { amount: stored },
    });
    return this.getOne(userId, id, today);
  },

  async unlog(userId: string, id: string, day: string, today: string = day) {
    await assertOwner(userId, id);
    assertPlausibleDay(day);
    await prisma.habitLog.deleteMany({ where: { habitId: id, date: asDate(day) } });
    return this.getOne(userId, id, today);
  },

  async getOne(userId: string, id: string, today: string) {
    const habit = await prisma.habit.findFirst({ where: { id, userId }, include: withLogs() });
    if (!habit) throw new NotFoundError("Habit not found.");
    return present(habit, today);
  },
};
