import { z } from "zod";

// Nutrition values support up to one decimal place (12 or 12.3, not
// 12.34) — checking at *100 rather than a naive `% 0.1` sidesteps binary
// floating-point representation error (0.1 + 0.2 !== 0.3-style issues).
function hasAtMostOneDecimal(value: number): boolean {
  return Math.round(value * 100) % 10 === 0;
}

function oneDecimalNumber(max: number) {
  return z
    .number()
    .min(0)
    .max(max)
    .refine(hasAtMostOneDecimal, "Use at most one decimal place, e.g. 12 or 12.3.");
}

export const mealEntrySchema = z.object({
  date: z.string().date(),
  time: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(160),
  calories: oneDecimalNumber(5000),
  proteinG: oneDecimalNumber(500),
  fibreG: oneDecimalNumber(200),
  servings: z.string().trim().min(1).max(60),
  carbsG: oneDecimalNumber(500).optional(),
  fatG: oneDecimalNumber(500).optional(),
  notes: z.string().trim().max(500).optional(),
});

export const updateMealSchema = mealEntrySchema.omit({ date: true }).partial();

export const hydrationLogSchema = z.object({
  date: z.string().date(),
  amountMl: z.number().int().min(1).max(5000),
});

export const fruitVegLogSchema = z.object({
  date: z.string().date(),
  servings: z.number().int().min(1).max(20).default(1),
});

export const nutritionGoalSchema = z.object({
  hydrationGoalMl: z.number().int().min(500).max(6000),
  proteinGoalG: z.number().min(0).max(500),
  fibreGoalG: z.number().min(0).max(200),
  fruitVegGoal: z.number().int().min(0).max(20),
});

export const dateQuerySchema = z.object({ date: z.string().date().optional() });
export const idParamSchema = z.object({ id: z.string().min(1) });
