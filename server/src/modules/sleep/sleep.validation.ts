import { z } from "zod";

// 1 Very poor, 2 Poor, 3 Fair, 4 Good, 5 Excellent — not a 0-100 percentage.
export const sleepEntrySchema = z.object({
  date: z.string().date(),
  // The day she went to bed. When it is sent, the server works out the duration from the two
  // days and times itself; without it (an older client) the duration sent is used.
  bedDate: z.string().date().optional(),
  durationHours: z.number().min(0).max(24),
  quality: z.number().int().min(1).max(5),
  bedtime: z.string().trim().min(1).max(20),
  wakeTime: z.string().trim().min(1).max(20),
  notes: z.string().trim().max(1000).optional(),
});

export const dateParamSchema = z.object({ date: z.string().date() });
