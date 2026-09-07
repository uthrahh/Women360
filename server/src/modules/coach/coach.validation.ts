import { z } from "zod";

export const grantAccessSchema = z.object({
  coachEmail: z.string().trim().toLowerCase().email("Enter a valid email address"),
});

export const revokeAccessSchema = z.object({
  coachId: z.string().min(1),
});

export const womanIdParamSchema = z.object({ womanId: z.string().min(1) });

export const createNoteSchema = z.object({
  note: z.string().trim().min(1).max(2000),
  visibleToWoman: z.boolean().default(true),
});
