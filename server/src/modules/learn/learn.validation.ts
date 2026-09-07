import { z } from "zod";

export const createArticleSchema = z.object({
  title: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(80),
  readMins: z.number().int().min(1).max(120),
  dek: z.string().trim().min(1).max(280),
  body: z.string().trim().max(20_000).optional(),
  publish: z.boolean().default(false),
});

export const updateArticleSchema = createArticleSchema.partial();
export const idParamSchema = z.object({ id: z.string().min(1) });
