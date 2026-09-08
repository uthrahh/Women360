import { prisma } from "@/lib/prisma";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// Guards against floating-point sums like 4.5 + 3.2 producing 7.699999999999999.
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export const nutritionService = {
  async getDailySummary(userId: string, date?: string) {
    const day = date ?? todayISO();
    const dayStart = new Date(day);

    const [goal, meals, hydrationLogs, fruitVegLogs] = await Promise.all([
      prisma.nutritionGoal.findUnique({ where: { userId } }),
      prisma.mealEntry.findMany({
        where: { userId, date: dayStart },
        orderBy: { time: "asc" },
      }),
      prisma.hydrationLog.findMany({ where: { userId, date: dayStart } }),
      prisma.fruitVegLog.findMany({ where: { userId, date: dayStart } }),
    ]);

    // Every nutrient total is a live sum over this day's actual meal rows —
    // never a separately-maintained counter that could drift out of sync.
    const hydrationMl = hydrationLogs.reduce((sum, l) => sum + l.amountMl, 0);
    const calories = round1(meals.reduce((sum, m) => sum + m.calories, 0));
    const proteinG = round1(meals.reduce((sum, m) => sum + m.proteinG, 0));
    const fibreG = round1(meals.reduce((sum, m) => sum + m.fibreG, 0));
    const carbsG = round1(meals.reduce((sum, m) => sum + (m.carbsG ?? 0), 0));
    const fatG = round1(meals.reduce((sum, m) => sum + (m.fatG ?? 0), 0));
    const fruitVeg = fruitVegLogs.reduce((sum, l) => sum + l.servings, 0);

    return {
      date: day,
      hydrationMl,
      hydrationGoalMl: goal?.hydrationGoalMl ?? 2200,
      calories,
      proteinG,
      proteinGoalG: goal?.proteinGoalG ?? 70,
      carbsG,
      fatG,
      fibreG,
      fibreGoalG: goal?.fibreGoalG ?? 28,
      fruitVeg,
      fruitVegGoal: goal?.fruitVegGoal ?? 5,
      meals,
    };
  },

  async addMeal(userId: string, input: {
    date: string; time: string; name: string; calories: number; proteinG: number; fibreG: number; servings: string;
    carbsG?: number; fatG?: number; notes?: string;
  }) {
    return prisma.mealEntry.create({
      data: { userId, ...input, date: new Date(input.date) },
    });
  },

  async updateMeal(userId: string, id: string, input: Partial<{
    time: string; name: string; calories: number; proteinG: number; fibreG: number; servings: string;
    carbsG: number; fatG: number; notes: string;
  }>) {
    const meal = await prisma.mealEntry.findUnique({ where: { id } });
    if (!meal) throw new NotFoundError("Meal entry not found.");
    if (meal.userId !== userId) throw new ForbiddenError();
    return prisma.mealEntry.update({ where: { id }, data: input });
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

  async logFruitVeg(userId: string, input: { date: string; servings: number }) {
    return prisma.fruitVegLog.create({
      data: { userId, date: new Date(input.date), servings: input.servings },
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
