import { z } from "zod";

export const createGoalSchema = z.object({
  title: z.string().trim().min(1).max(160),
  category: z.enum(["SLEEP", "ACTIVITY", "HYDRATION", "NUTRITION", "STRENGTH", "CYCLE", "MOBILITY"]),
  target: z.string().trim().min(1).max(120),
  reminder: z.string().trim().max(120).optional(),
});

export const updateGoalSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  target: z.string().trim().min(1).max(120).optional(),
  progress: z.number().int().min(0).max(100).optional(),
  reminder: z.string().trim().max(120).optional(),
  completed: z.boolean().optional(),
});

export const idParamSchema = z.object({ id: z.string().min(1) });
