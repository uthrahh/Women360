import { z } from "zod";

// A fixed vocabulary (not free text) so these can drive prediction logic and
// be reasoned about later. Mirrors CONTEXT_TAG_OPTIONS in the frontend.
export const CONTEXT_TAGS = [
  "stress",
  "illness",
  "travel",
  "new_medication",
  "contraception_change",
  "intense_exercise",
  "weight_change",
  "sleep_disruption",
] as const;

// Optional details she can record. Recorded for her own reference only: nothing predicts from them.
export const CERVICAL_MUCUS = ["dry", "sticky", "creamy", "watery", "egg_white"] as const;
export const INTERCOURSE = ["none", "protected", "unprotected"] as const;

export const cycleEntrySchema = z.object({
  date: z.string().date(),
  isPeriod: z.boolean().default(false),
  flow: z.enum(["SPOTTING", "LIGHT", "MEDIUM", "HEAVY"]).optional(),
  pain: z.number().int().min(0).max(4).optional(),
  energy: z.number().int().min(0).max(4).optional(),
  mood: z.string().trim().max(60).optional(),
  symptoms: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
  notes: z.string().trim().max(1000).optional(),
  contextTags: z.array(z.enum(CONTEXT_TAGS)).max(CONTEXT_TAGS.length).optional(),
  excludeCycle: z.boolean().optional(),
  // null clears a detail recorded earlier.
  cervicalMucus: z.enum(CERVICAL_MUCUS).nullable().optional(),
  // Temperature on waking, Celsius; outside this range it is almost certainly a typo or a fever reading, not a baseline.
  bbtC: z.number().min(35).max(38.5).nullable().optional(),
  intercourse: z.enum(INTERCOURSE).nullable().optional(),
  productsUsed: z.number().int().min(0).max(40).nullable().optional(),
});

export const cycleProfileSchema = z.object({
  averageCycleLength: z.number().int().min(15).max(90),
  averagePeriodLength: z.number().int().min(1).max(15),
  showOvulationOnHome: z.boolean().optional(),
});

export const listQuerySchema = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});

export const phaseCalendarQuerySchema = z.object({
  from: z.string().date(),
  to: z.string().date(),
  today: z.string().date().optional(),
});

// The browser's own local calendar date, so "current cycle day" doesn't
// undercount for a user meaningfully ahead of UTC (see cycle.service.ts).
export const summaryQuerySchema = z.object({
  today: z.string().date().optional(),
});

export const dateParamSchema = z.object({ date: z.string().date() });
