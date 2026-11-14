import { z } from "zod";

export const wellbeingEntrySchema = z.object({
  date: z.string().date(),
  mood: z.number().int().min(0).max(4),
  // Optional: she may rate only her mood. null clears an earlier answer; leaving a field out keeps it as it was.
  stress: z.number().int().min(0).max(4).nullable().optional(),
  energy: z.number().int().min(0).max(4).nullable().optional(),
  note: z.string().trim().max(1000).optional(),
});
