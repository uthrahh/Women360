import { z } from "zod";
import { ACTIVITY_CODES } from "../catalog";
import { PLAN_GOALS } from "./guidelines";

const day = z.string().date();

export const PLAN_WEEKS = [4, 8, 12] as const;

export const planRequestSchema = z.object({
  goal: z.enum(PLAN_GOALS),
  weeks: z.union([z.literal(4), z.literal(8), z.literal(12)]),
  days: z
    .array(z.number().int().min(1).max(7))
    .min(1)
    .max(7)
    .refine((d) => new Set(d).size === d.length, "Each day can only be chosen once."),
  sessionMinutes: z.number().int().min(10).max(180),
  startDate: day,
  activityCodes: z.array(z.enum(ACTIVITY_CODES)).max(5).default([]),
});

export const todayQuerySchema = z.object({ today: day });
export const planIdParamSchema = z.object({ id: z.string().min(1) });
