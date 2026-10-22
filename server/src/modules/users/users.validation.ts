import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  dateOfBirth: z.string().date().optional(),
  lifeStage: z.enum(["REPRODUCTIVE", "PERIMENOPAUSE", "MENOPAUSE", "POSTMENOPAUSE"]).optional(),
});

export const updateEmergencyContactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(3).max(32),
  relationship: z.string().trim().max(60).optional(),
});

export const seniorEssentialKeySchema = z.enum([
  "HEALTH",
  "MEDICINES",
  "APPOINTMENTS",
  "ACTIVITY",
  "SLEEP",
  "NUTRITION",
  "MESSAGES",
  "CYCLE",
  "EMERGENCY",
]);

export const toggleSeniorEssentialSchema = z.object({
  key: seniorEssentialKeySchema,
  enabled: z.boolean(),
});

export const reproductiveHealthSchema = z.object({
  contraception: z
    .enum(["NONE", "PILL", "IUD_COPPER", "IUD_HORMONAL", "IMPLANT", "INJECTION", "CONDOM", "NATURAL_METHODS", "STERILISATION", "OTHER"])
    .nullable()
    .optional(),
  pregnancyStatus: z.enum(["NOT_PREGNANT", "TRYING_TO_CONCEIVE", "PREGNANT", "POSTPARTUM"]).nullable().optional(),
  expectedDueDate: z.string().date().nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});
