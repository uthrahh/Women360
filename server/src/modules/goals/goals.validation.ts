import { z } from "zod";

export const createGoalSchema = z.object({
  title: z.string().trim().min(1).max(160),
  category: z.enum(["SLEEP", "ACTIVITY", "HYDRATION", "NUTRITION", "STRENGTH", "CYCLE", "MOBILITY"]),
  currentValue: z.number().min(0).max(1_000_000).optional(),
  targetValue: z.number().positive().max(1_000_000),
  unit: z.string().trim().min(1).max(20),
  reminder: z.string().trim().max(120).optional(),
});

export const updateGoalSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  currentValue: z.number().min(0).max(1_000_000).optional(),
  targetValue: z.number().positive().max(1_000_000).optional(),
  unit: z.string().trim().min(1).max(20).optional(),
  reminder: z.string().trim().max(120).optional(),
  completed: z.boolean().optional(),
});

export const idParamSchema = z.object({ id: z.string().min(1) });
