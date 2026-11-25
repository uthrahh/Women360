import { z } from "zod";
import { MICRO_CODES, nutrientByCode } from "./nutrients";

// Nutrition values support up to one decimal place (12 or 12.3, not
// 12.34) — checking at *100 rather than a naive `% 0.1` sidesteps binary
// floating-point representation error (0.1 + 0.2 !== 0.3-style issues).
function hasAtMostOneDecimal(value: number): boolean {
  return Math.round(value * 100) % 10 === 0;
}

function oneDecimalNumber(max: number) {
  return z
    .number()
    .min(0)
    .max(max)
    .refine(hasAtMostOneDecimal, "Use at most one decimal place, e.g. 12 or 12.3.");
}

export const mealEntrySchema = z.object({
  date: z.string().date(),
  time: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(160),
  calories: oneDecimalNumber(5000),
  proteinG: oneDecimalNumber(500),
  fibreG: oneDecimalNumber(200),
  servings: z.string().trim().min(1).max(60),
  // Nullable (not just optional): a client clearing these on an edit sends
  // an explicit null, which Prisma writes as NULL — an omitted key instead
  // leaves the previously-saved value untouched, which is the bug this is
  // fixing (see updateMealSchema below).
  carbsG: oneDecimalNumber(500).nullable().optional(),
  fatG: oneDecimalNumber(500).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  // Optional vitamins and minerals for this meal: { iron: 2.1, calcium: 120 }. Unknown nutrients are refused, not ignored.
  micros: z
    .record(z.string(), z.number())
    .superRefine((value, ctx) => {
      for (const [code, amount] of Object.entries(value)) {
        const def = nutrientByCode(code);
        if (!def || !(MICRO_CODES as string[]).includes(code)) ctx.addIssue({ code: "custom", message: `${code} isn't a nutrient we track here.` });
        else if (!(amount >= 0) || amount > def.max || !hasAtMostOneDecimal(amount)) ctx.addIssue({ code: "custom", message: `${def.label}: use 0 to ${def.max} ${def.unit}, one decimal at most.` });
      }
    })
    .nullable()
    .optional(),
});

export const updateMealSchema = mealEntrySchema.omit({ date: true }).partial();

export const hydrationLogSchema = z.object({
  date: z.string().date(),
  amountMl: z.number().int().min(1).max(5000),
});

export const fruitVegLogSchema = z.object({
  date: z.string().date(),
  servings: z.number().int().min(1).max(20).default(1),
});

export const nutritionGoalSchema = z.object({
  hydrationGoalMl: z.number().int().min(500).max(6000),
  proteinGoalG: z.number().min(0).max(500),
  fibreGoalG: z.number().min(0).max(200),
  fruitVegGoal: z.number().int().min(0).max(20),
});

export const nutrientCodeParamSchema = z.object({ code: z.string().min(1).max(40) });
export const nutrientTargetSchema = z.object({
  amount: z.number().positive().max(100_000),
  mode: z.enum(["AT_LEAST", "AT_MOST"]).default("AT_LEAST"),
});

export const dateQuerySchema = z.object({ date: z.string().date().optional() });
export const idParamSchema = z.object({ id: z.string().min(1) });
