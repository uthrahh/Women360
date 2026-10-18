import { prisma } from "@/lib/prisma";
import { BadRequestError, ForbiddenError, NotFoundError } from "@/lib/errors";
import type { Goal, GoalCategory } from "@prisma/client";
import { computeStreak, dayNumber, toIsoDay } from "./streak";

interface CreateGoalInput {
  title: string;
  category: GoalCategory;
  currentValue?: number;
  targetValue: number;
  unit: string;
  reminder?: string;
}

interface UpdateGoalInput {
  title?: string;
  currentValue?: number;
  targetValue?: number;
  unit?: string;
  reminder?: string;
  completed?: boolean;
}

// How far from the server's own UTC date a client-supplied "today" may be.
// Real timezones span UTC-12..UTC+14, so a day of slack either side is honest;
// anything further is a wrong clock or a hand-made request.
const FUTURE_SLACK_DAYS = 1;
const BACKFILL_DAYS = 7;

async function assertOwner(userId: string, id: string) {
  const goal = await prisma.goal.findUnique({ where: { id } });
  if (!goal) throw new NotFoundError("Goal not found.");
  if (goal.userId !== userId) throw new ForbiddenError();
  return goal;
}

export function assertPlausibleDay(isoDay: string, now = new Date()) {
  const offset = dayNumber(isoDay) - dayNumber(toIsoDay(now));
  if (offset > FUTURE_SLACK_DAYS) throw new BadRequestError("You can't check in for a future day.");
  if (offset < -BACKFILL_DAYS) throw new BadRequestError("That day is too far back to check in for.");
}

type GoalWithCheckIns = Goal & { checkIns: { date: Date }[] };

function present(goal: GoalWithCheckIns, today: string) {
  const { checkIns, ...rest } = goal;
  return { ...rest, ...computeStreak(checkIns.map((c) => toIsoDay(c.date)), today) };
}

export const goalsService = {
  async list(userId: string, today = toIsoDay(new Date())) {
    const goals = await prisma.goal.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { checkIns: { select: { date: true }, orderBy: { date: "desc" } } },
    });
    return goals.map((g) => present(g, today));
  },

  async create(userId: string, input: CreateGoalInput, today = toIsoDay(new Date())) {
    const goal = await prisma.goal.create({ data: { ...input, userId }, include: { checkIns: { select: { date: true } } } });
    return present(goal, today);
  },

  async update(userId: string, id: string, input: UpdateGoalInput, today = toIsoDay(new Date())) {
    await assertOwner(userId, id);
    const goal = await prisma.goal.update({
      where: { id },
      data: input,
      include: { checkIns: { select: { date: true } } },
    });
    return present(goal, today);
  },

  async remove(userId: string, id: string) {
    await assertOwner(userId, id);
    await prisma.goal.delete({ where: { id } });
  },

  // Idempotent: checking in twice for the same day is the same as once.
  async checkIn(userId: string, id: string, day: string) {
    await assertOwner(userId, id);
    assertPlausibleDay(day);
    const date = new Date(`${day}T00:00:00.000Z`);
    await prisma.goalCheckIn.upsert({
      where: { goalId_date: { goalId: id, date } },
      create: { goalId: id, date },
      update: {},
    });
    return this.getOne(userId, id, day);
  },

  async undoCheckIn(userId: string, id: string, day: string) {
    await assertOwner(userId, id);
    assertPlausibleDay(day);
    await prisma.goalCheckIn.deleteMany({ where: { goalId: id, date: new Date(`${day}T00:00:00.000Z`) } });
    return this.getOne(userId, id, day);
  },

  async getOne(userId: string, id: string, today: string) {
    const goal = await prisma.goal.findFirst({
      where: { id, userId },
      include: { checkIns: { select: { date: true } } },
    });
    if (!goal) throw new NotFoundError("Goal not found.");
    return present(goal, today);
  },
};
