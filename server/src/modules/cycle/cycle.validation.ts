import { z } from "zod";

export const cycleEntrySchema = z.object({
  date: z.string().date(),
  isPeriod: z.boolean().default(false),
  flow: z.enum(["SPOTTING", "LIGHT", "MEDIUM", "HEAVY"]).optional(),
  pain: z.number().int().min(0).max(4).optional(),
  energy: z.number().int().min(0).max(4).optional(),
  mood: z.string().trim().max(60).optional(),
  symptoms: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const cycleProfileSchema = z.object({
  averageCycleLength: z.number().int().min(15).max(90),
  averagePeriodLength: z.number().int().min(1).max(15),
});

export const listQuerySchema = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});

export const dateParamSchema = z.object({ date: z.string().date() });
