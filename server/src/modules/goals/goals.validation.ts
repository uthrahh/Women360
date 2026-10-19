import { z } from "zod";
import { isValidIsoDay } from "@/lib/streak";

const isoDay = z.string().refine(isValidIsoDay, "Use a date in YYYY-MM-DD format.");

const CATEGORIES = [
  "SLEEP", "ACTIVITY", "HYDRATION", "NUTRITION", "STRENGTH", "CYCLE", "MOBILITY",
  "BODY", "LEARNING", "PREVENTIVE", "OTHER",
] as const;
const KINDS = ["TOTAL", "REACH", "ONE_OFF"] as const;

// Only what each kind needs is required, so the app can ask for exactly that:
//  TOTAL   - a target total (read 12 books)
//  REACH   - where you are now and where you want to be (weight 72 -> 67)
//  ONE_OFF - just a title (book a check-up)
export const createGoalSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    kind: z.enum(KINDS).default("TOTAL"),
    category: z.enum(CATEGORIES).optional(),
    currentValue: z.number().min(0).max(1_000_000).optional(),
    startValue: z.number().min(0).max(1_000_000).optional(),
    targetValue: z.number().min(0).max(1_000_000).optional(),
    unit: z.string().trim().max(20).optional(),
    reminder: z.string().trim().max(120).optional(),
    dueDate: isoDay.optional(),
  })
  .superRefine((g, ctx) => {
    if (g.kind === "TOTAL" && !(g.targetValue !== undefined && g.targetValue > 0)) {
      ctx.addIssue({ code: "custom", path: ["targetValue"], message: "Enter a target greater than 0." });
    }
    if (g.kind === "REACH") {
      const start = g.startValue ?? g.currentValue;
      if (start === undefined) ctx.addIssue({ code: "custom", path: ["currentValue"], message: "Enter where you are now." });
      if (g.targetValue === undefined) ctx.addIssue({ code: "custom", path: ["targetValue"], message: "Enter your target." });
      else if (start !== undefined && g.targetValue === start) {
        ctx.addIssue({ code: "custom", path: ["targetValue"], message: "Your target should be different from where you are now." });
      }
    }
  });

export const updateGoalSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  category: z.enum(CATEGORIES).optional(),
  currentValue: z.number().min(0).max(1_000_000).optional(),
  targetValue: z.number().min(0).max(1_000_000).optional(),
  unit: z.string().trim().max(20).optional(),
  reminder: z.string().trim().max(120).optional(),
  completed: z.boolean().optional(),
  // null clears a due date.
  dueDate: isoDay.nullable().optional(),
});

export const idParamSchema = z.object({ id: z.string().min(1) });
