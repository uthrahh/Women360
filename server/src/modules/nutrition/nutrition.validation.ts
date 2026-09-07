import { z } from "zod";

export const mealEntrySchema = z.object({
  date: z.string().date(),
  time: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(160),
  calories: z.number().int().min(0).max(5000),
  proteinG: z.number().min(0).max(500),
  fibreG: z.number().min(0).max(200),
  servings: z.string().trim().min(1).max(60),
});

export const hydrationLogSchema = z.object({
  date: z.string().date(),
  amountMl: z.number().int().min(1).max(5000),
});

export const nutritionGoalSchema = z.object({
  hydrationGoalMl: z.number().int().min(500).max(6000),
  proteinGoalG: z.number().min(0).max(500),
  fibreGoalG: z.number().min(0).max(200),
  fruitVegGoal: z.number().int().min(0).max(20),
});

export const dateQuerySchema = z.object({ date: z.string().date().optional() });
export const idParamSchema = z.object({ id: z.string().min(1) });
