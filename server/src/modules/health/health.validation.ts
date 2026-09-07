import { z } from "zod";

export const appointmentSchema = z.object({
  title: z.string().trim().min(1).max(160),
  provider: z.string().trim().min(1).max(160),
  date: z.string().datetime().or(z.string().date()),
  time: z.string().trim().min(1).max(20),
  location: z.string().trim().min(1).max(200),
  kind: z.enum(["CHECKUP", "SCREENING", "VACCINATION", "COACH"]),
});

export const medicationSchema = z.object({
  name: z.string().trim().min(1).max(160),
  dose: z.string().trim().min(1).max(80),
  schedule: z.string().trim().min(1).max(160),
  remaining: z.number().int().min(0).max(10_000).optional(),
});

export const vitalSchema = z.object({
  type: z.enum(["WEIGHT", "BLOOD_PRESSURE", "RESTING_HR"]),
  value: z.string().trim().min(1).max(40),
  date: z.string().datetime().or(z.string().date()),
});

export const idParamSchema = z.object({ id: z.string().min(1) });
