import { prisma } from "@/lib/prisma";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import type { GoalCategory, GoalKind } from "@prisma/client";

interface CreateGoalInput {
  title: string;
  kind: GoalKind;
  category?: GoalCategory;
  currentValue?: number;
  startValue?: number;
  targetValue?: number;
  unit?: string;
  reminder?: string;
  dueDate?: string;
}

interface UpdateGoalInput {
  title?: string;
  category?: GoalCategory;
  currentValue?: number;
  targetValue?: number;
  unit?: string;
  reminder?: string;
  completed?: boolean;
  dueDate?: string | null;
}

const DEFAULT_CATEGORY: Record<GoalKind, GoalCategory> = { TOTAL: "OTHER", REACH: "BODY", ONE_OFF: "OTHER" };

const asDate = (day: string) => new Date(`${day}T00:00:00.000Z`);

async function assertOwner(userId: string, id: string) {
  const goal = await prisma.goal.findUnique({ where: { id } });
  if (!goal) throw new NotFoundError("Goal not found.");
  if (goal.userId !== userId) throw new ForbiddenError();
  return goal;
}

export const goalsService = {
  async list(userId: string) {
    return prisma.goal.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  },

  async create(userId: string, input: CreateGoalInput) {
    const { kind, dueDate, startValue, currentValue, targetValue, ...rest } = input;
    // A one-off has nothing to count: it's 0 of 1 until it's done.
    const oneOff = kind === "ONE_OFF";
    const now = oneOff ? 0 : (currentValue ?? startValue ?? 0);
    return prisma.goal.create({
      data: {
        ...rest,
        userId,
        kind,
        category: input.category ?? DEFAULT_CATEGORY[kind],
        unit: input.unit ?? "",
        currentValue: now,
        // Progress on a REACH goal is measured from where it started.
        startValue: kind === "REACH" ? (startValue ?? currentValue ?? 0) : null,
        targetValue: oneOff ? 1 : (targetValue ?? 100),
        dueDate: dueDate ? asDate(dueDate) : null,
      },
    });
  },

  async update(userId: string, id: string, input: UpdateGoalInput) {
    const goal = await assertOwner(userId, id);
    const { dueDate, ...rest } = input;
    return prisma.goal.update({
      where: { id },
      data: {
        ...rest,
        ...(dueDate === undefined ? {} : { dueDate: dueDate === null ? null : asDate(dueDate) }),
        // Ticking a one-off done also moves its 0-of-1 counter, so anything that
        // reads the numbers (reports) agrees with the flag.
        ...(goal.kind === "ONE_OFF" && input.completed !== undefined ? { currentValue: input.completed ? 1 : 0 } : {}),
      },
    });
  },

  async remove(userId: string, id: string) {
    await assertOwner(userId, id);
    await prisma.goal.delete({ where: { id } });
  },
};
