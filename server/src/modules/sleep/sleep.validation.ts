import { z } from "zod";

export const sleepEntrySchema = z.object({
  date: z.string().date(),
  durationHours: z.number().min(0).max(24),
  quality: z.number().int().min(0).max(100),
  bedtime: z.string().trim().min(1).max(20),
  wakeTime: z.string().trim().min(1).max(20),
  notes: z.string().trim().max(1000).optional(),
});

export const dateParamSchema = z.object({ date: z.string().date() });
