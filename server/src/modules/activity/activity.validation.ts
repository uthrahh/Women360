import { z } from "zod";

export const activityEntrySchema = z.object({
  date: z.string().date(),
  type: z.string().trim().min(1).max(80),
  durationMinutes: z.number().int().min(0).max(1440),
  intensity: z.enum(["LOW", "MODERATE", "HIGH"]),
  notes: z.string().trim().max(500).optional(),
});

export const stepsLogSchema = z.object({
  date: z.string().date(),
  steps: z.number().int().min(0).max(200_000),
});

export const activityGoalSchema = z.object({
  stepsGoal: z.number().int().min(1000).max(50_000),
  activeMinutesGoal: z.number().int().min(5).max(600),
});

export const idParamSchema = z.object({ id: z.string().min(1) });
