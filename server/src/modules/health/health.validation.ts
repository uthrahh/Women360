import { z } from "zod";

export const appointmentSchema = z.object({
  title: z.string().trim().min(1).max(160),
  provider: z.string().trim().min(1).max(160),
  date: z.string().datetime().or(z.string().date()),
  time: z.string().trim().min(1).max(20),
  location: z.string().trim().min(1).max(200),
  kind: z.enum(["CHECKUP", "SCREENING", "VACCINATION", "COACH"]),
});

const timeOfDaySchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a 24-hour HH:MM time.");

export const medicationSchema = z.object({
  name: z.string().trim().min(1).max(160),
  dose: z.string().trim().min(1).max(80),
  schedule: z.string().trim().min(1).max(160),
  times: z.array(timeOfDaySchema).max(10).optional(),
  remaining: z.number().int().min(0).max(10_000).optional(),
});

export const logMedicationDoseSchema = z.object({
  scheduledFor: z.string().datetime(),
  status: z.enum(["TAKEN", "SKIPPED"]),
});

export const adherenceQuerySchema = z.object({
  days: z.coerce.number().int().refine((n) => n === 7 || n === 30, "days must be 7 or 30").optional(),
});

export const vitalSchema = z.object({
  type: z.enum(["WEIGHT", "BLOOD_PRESSURE", "RESTING_HR"]),
  value: z.string().trim().min(1).max(40),
  date: z.string().datetime().or(z.string().date()),
});

export const idParamSchema = z.object({ id: z.string().min(1) });
