import { prisma } from "@/lib/prisma";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import type { GoalCategory } from "@prisma/client";

interface CreateGoalInput {
  title: string;
  category: GoalCategory;
  target: string;
  reminder?: string;
}

interface UpdateGoalInput {
  title?: string;
  target?: string;
  progress?: number;
  reminder?: string;
  completed?: boolean;
}

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
    return prisma.goal.create({ data: { ...input, userId } });
  },

  async update(userId: string, id: string, input: UpdateGoalInput) {
    await assertOwner(userId, id);
    return prisma.goal.update({ where: { id }, data: input });
  },

  async remove(userId: string, id: string) {
    await assertOwner(userId, id);
    await prisma.goal.delete({ where: { id } });
  },
};
