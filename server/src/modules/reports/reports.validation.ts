import { z } from "zod";

export const generateReportSchema = z.object({
  title: z.string().trim().min(1).max(160),
  rangeLabel: z.string().trim().min(1).max(80),
  rangeDays: z.number().int().min(1).max(365).default(90),
});

export const idParamSchema = z.object({ id: z.string().min(1) });
