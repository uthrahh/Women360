import { prisma } from "@/lib/prisma";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export const nutritionService = {
  async getDailySummary(userId: string, date?: string) {
    const day = date ?? todayISO();
    const dayStart = new Date(day);

    const [goal, meals, hydrationLogs] = await Promise.all([
      prisma.nutritionGoal.findUnique({ where: { userId } }),
      prisma.mealEntry.findMany({
        where: { userId, date: dayStart },
        orderBy: { time: "asc" },
      }),
      prisma.hydrationLog.findMany({ where: { userId, date: dayStart } }),
    ]);

    const hydrationMl = hydrationLogs.reduce((sum, l) => sum + l.amountMl, 0);
    const proteinG = meals.reduce((sum, m) => sum + m.proteinG, 0);
    const fibreG = meals.reduce((sum, m) => sum + m.fibreG, 0);

    return {
      date: day,
      hydrationMl,
      hydrationGoalMl: goal?.hydrationGoalMl ?? 2200,
      proteinG,
      proteinGoalG: goal?.proteinGoalG ?? 70,
      fibreG,
      fibreGoalG: goal?.fibreGoalG ?? 28,
      fruitVeg: 0, // requires a food-database lookup; not modeled yet — see roadmap
      fruitVegGoal: goal?.fruitVegGoal ?? 5,
      meals,
    };
  },

  async addMeal(userId: string, input: {
    date: string; time: string; name: string; calories: number; proteinG: number; fibreG: number; servings: string;
  }) {
    return prisma.mealEntry.create({
      data: { userId, ...input, date: new Date(input.date) },
    });
  },

  async deleteMeal(userId: string, id: string) {
    const meal = await prisma.mealEntry.findUnique({ where: { id } });
    if (!meal) throw new NotFoundError("Meal entry not found.");
    if (meal.userId !== userId) throw new ForbiddenError();
    await prisma.mealEntry.delete({ where: { id } });
  },

  async logHydration(userId: string, input: { date: string; amountMl: number }) {
    return prisma.hydrationLog.create({
      data: { userId, date: new Date(input.date), amountMl: input.amountMl },
    });
  },

  async getGoal(userId: string) {
    return prisma.nutritionGoal.findUnique({ where: { userId } });
  },

  async upsertGoal(userId: string, input: {
    hydrationGoalMl: number; proteinGoalG: number; fibreGoalG: number; fruitVegGoal: number;
  }) {
    return prisma.nutritionGoal.upsert({
      where: { userId },
      create: { userId, ...input },
      update: input,
    });
  },
};
