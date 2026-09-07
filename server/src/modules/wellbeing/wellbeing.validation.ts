import { z } from "zod";

export const wellbeingEntrySchema = z.object({
  date: z.string().date(),
  mood: z.number().int().min(0).max(4),
  stress: z.number().int().min(0).max(4),
  energy: z.number().int().min(0).max(4),
  note: z.string().trim().max(1000).optional(),
});
