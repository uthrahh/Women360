import { Prisma } from "@prisma/client";
import type { TargetMode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BadRequestError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { LEGACY_GOAL_FIELD, NUTRIENTS, hasAtMostOneDecimal, isLegacy, nutrientByCode, round1 as roundOne } from "./nutrients";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// Guards against floating-point sums like 4.5 + 3.2 producing 7.699999999999999.
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

// `time` is stored as a display string ("8:00 AM", "12:30 PM"), which sorts
// wrong as text (text order puts every AM time after every PM time once one
// of them has two digits in the hour). Parse it back into minutes-from-
// midnight to sort meals the way they actually happened during the day.
function timeToMinutes(display: string): number {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(display.trim());
  if (!match) return 0;
  const hour12 = Number(match[1]) % 12;
  const hour = match[3].toUpperCase() === "PM" ? hour12 + 12 : hour12;
  return hour * 60 + Number(match[2]);
}

export const nutritionService = {
  async getDailySummary(userId: string, date?: string) {
    const day = date ?? todayISO();
    const dayStart = new Date(day);

    const [goal, meals, hydrationLogs, fruitVegLogs] = await Promise.all([
      prisma.nutritionGoal.findUnique({ where: { userId } }),
      prisma.mealEntry.findMany({ where: { userId, date: dayStart } }),
      prisma.hydrationLog.findMany({ where: { userId, date: dayStart } }),
      prisma.fruitVegLog.findMany({ where: { userId, date: dayStart } }),
    ]);
    meals.sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));

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

  // Most recently logged meals, one row per distinct name — lets the UI
  // offer a one-tap "log again" instead of retyping every field for a meal
  // that's been logged before, which is the single biggest source of the
  // tracking fatigue named in nutrition-app research.
  async getRecentMeals(userId: string, limit = 8) {
    return prisma.mealEntry.findMany({
      where: { userId },
      orderBy: [{ date: "desc" }, { time: "desc" }],
      distinct: ["name"],
      take: limit,
    });
  },

  async addMeal(userId: string, input: {
    date: string; time: string; name: string; calories: number; proteinG: number; fibreG: number; servings: string;
    carbsG?: number | null; fatG?: number | null; notes?: string | null; micros?: Record<string, number> | null;
  }) {
    const { micros, ...rest } = input;
    return prisma.mealEntry.create({
      data: { userId, ...rest, micros: micros && Object.keys(micros).length ? micros : undefined, date: new Date(input.date) },
    });
  },

  async updateMeal(userId: string, id: string, input: Partial<{
    time: string; name: string; calories: number; proteinG: number; fibreG: number; servings: string;
    carbsG: number | null; fatG: number | null; notes: string | null; micros: Record<string, number> | null;
  }>) {
    const meal = await prisma.mealEntry.findUnique({ where: { id } });
    if (!meal) throw new NotFoundError("Meal entry not found.");
    if (meal.userId !== userId) throw new ForbiddenError();
    const { micros, ...rest } = input;
    return prisma.mealEntry.update({
      where: { id },
      // null clears the amounts; an omitted key leaves them as they were.
      data: { ...rest, ...(micros === undefined ? {} : { micros: micros && Object.keys(micros).length ? micros : Prisma.DbNull }) },
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

  async logFruitVeg(userId: string, input: { date: string; servings: number }) {
    return prisma.fruitVegLog.create({
      data: { userId, date: new Date(input.date), servings: input.servings },
    });
  },

  /**
   * Her nutrient targets with today's total beside each, and the nutrients she has not set one for yet.
   * Protein, fibre, water and fruit and veg always have one (they were on the page from the start); everything else
   * only appears once she chooses an amount. Totals are live sums over the day's rows, like the rest of the summary.
   */
  async getTargets(userId: string, date?: string) {
    const day = new Date(date ?? todayISO());
    const [goal, rows, meals, hydration, fruitVeg] = await Promise.all([
      prisma.nutritionGoal.findUnique({ where: { userId } }),
      prisma.nutrientTarget.findMany({ where: { userId } }),
      prisma.mealEntry.findMany({ where: { userId, date: day } }),
      prisma.hydrationLog.findMany({ where: { userId, date: day } }),
      prisma.fruitVegLog.findMany({ where: { userId, date: day } }),
    ]);
    const mealSum = (pick: (m: (typeof meals)[number]) => number) => roundOne(meals.reduce((sum, m) => sum + pick(m), 0));
    const microSum = (code: string) =>
      roundOne(meals.reduce((sum, m) => sum + (((m.micros as Record<string, number> | null) ?? {})[code] ?? 0), 0));
    const totalOf = (code: string): number => {
      switch (code) {
        case "protein": return mealSum((m) => m.proteinG);
        case "carbs": return mealSum((m) => m.carbsG ?? 0);
        case "fat": return mealSum((m) => m.fatG ?? 0);
        case "fibre": return mealSum((m) => m.fibreG);
        case "water": return hydration.reduce((sum, l) => sum + l.amountMl, 0);
        case "fruitveg": return fruitVeg.reduce((sum, l) => sum + l.servings, 0);
        default: return microSum(code);
      }
    };
    const legacyDefaults = { proteinGoalG: 70, fibreGoalG: 28, hydrationGoalMl: 2200, fruitVegGoal: 5 };
    const chosen = new Map(rows.map((r) => [r.nutrient, r]));
    const targets: { code: string; label: string; unit: string; group: string; mode: TargetMode; amount: number; total: number; usual: boolean }[] = [];
    const available: { code: string; label: string; unit: string; group: string; usuallyAtMost: boolean }[] = [];
    for (const n of NUTRIENTS) {
      const base = { code: n.code, label: n.label, unit: n.unit, group: n.group };
      if (isLegacy(n.code)) {
        const field = LEGACY_GOAL_FIELD[n.code];
        const amount = goal?.[field] ?? legacyDefaults[field];
        targets.push({ ...base, mode: "AT_LEAST", amount, total: totalOf(n.code), usual: goal === null });
      } else if (chosen.has(n.code)) {
        const row = chosen.get(n.code)!;
        targets.push({ ...base, mode: row.mode, amount: row.amount, total: totalOf(n.code), usual: false });
      } else {
        available.push({ ...base, usuallyAtMost: n.usuallyAtMost === true });
      }
    }
    return { date: day.toISOString().slice(0, 10), targets, available };
  },

  async setTarget(userId: string, code: string, input: { amount: number; mode: TargetMode }) {
    const def = nutrientByCode(code);
    if (!def) throw new NotFoundError("That nutrient isn't one we track.");
    if (!(input.amount > 0) || input.amount > def.max) throw new BadRequestError(`Choose an amount above 0 and up to ${def.max} ${def.unit}.`);
    if (def.whole ? !Number.isInteger(input.amount) : !hasAtMostOneDecimal(input.amount)) {
      throw new BadRequestError(def.whole ? "Use a whole number." : "Use at most one decimal place, e.g. 12 or 12.3.");
    }
    if (isLegacy(code)) {
      // These four are always "at least" and live where they always have.
      const field = LEGACY_GOAL_FIELD[code];
      await prisma.nutritionGoal.upsert({ where: { userId }, create: { userId, [field]: input.amount }, update: { [field]: input.amount } });
      return;
    }
    await prisma.nutrientTarget.upsert({
      where: { userId_nutrient: { userId, nutrient: code } },
      create: { userId, nutrient: code, amount: input.amount, mode: input.mode },
      update: { amount: input.amount, mode: input.mode },
    });
  },

  async removeTarget(userId: string, code: string) {
    if (!nutrientByCode(code)) throw new NotFoundError("That nutrient isn't one we track.");
    if (isLegacy(code)) throw new BadRequestError("Protein, fibre, water and fruit and veg always have a target; you can change the amount.");
    await prisma.nutrientTarget.deleteMany({ where: { userId, nutrient: code } });
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
