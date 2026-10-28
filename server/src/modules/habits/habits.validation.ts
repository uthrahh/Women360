import { z } from "zod";
import { isValidIsoDay } from "@/lib/streak";
import { ACTIVITY_CODES } from "@/modules/activity/catalog";

const isoDay = z.string().refine(isValidIsoDay, "Use a date in YYYY-MM-DD format.");

const fields = {
  title: z.string().trim().min(1).max(120),
  // A target makes it an amount habit ("10,000 steps"); without one it's ticked off.
  target: z.number().positive().max(1_000_000).nullable(),
  unit: z.string().trim().max(20).nullable(),
  // 7 = every day; 1-6 = that many days a week.
  daysPerWeek: z.number().int().min(1).max(7),
  reminder: z.string().trim().max(120).nullable(),
  // A catalog activity, or "any" for general movement; null when the habit is not an activity.
  activityCode: z.enum([...ACTIVITY_CODES, "any"]).nullable(),
};

export const createHabitSchema = z.object({
  title: fields.title,
  target: fields.target.optional(),
  unit: fields.unit.optional(),
  daysPerWeek: fields.daysPerWeek.default(7),
  reminder: fields.reminder.optional(),
  activityCode: fields.activityCode.optional(),
});

export const updateHabitSchema = z.object({
  title: fields.title.optional(),
  target: fields.target.optional(),
  unit: fields.unit.optional(),
  daysPerWeek: fields.daysPerWeek.optional(),
  reminder: fields.reminder.optional(),
  activityCode: fields.activityCode.optional(),
  archived: z.boolean().optional(),
});

export const habitIdSchema = z.object({ id: z.string().min(1) });
export const habitDaySchema = z.object({ id: z.string().min(1), date: isoDay });
export const habitQuerySchema = z.object({ today: isoDay.optional() });
export const logBodySchema = z.object({ amount: z.number().min(0).max(1_000_000).optional() });
