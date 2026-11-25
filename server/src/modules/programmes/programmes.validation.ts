import { z } from "zod";
import { isValidIsoDay } from "@/lib/streak";

const isoDay = z.string().refine(isValidIsoDay, "Use a date in YYYY-MM-DD format.");
const words = (max: number) => z.string().trim().min(1).max(max);
const optionalWords = (max: number) => z.string().trim().max(max).nullable().optional().transform((v) => (v ? v : null));

const CATEGORY = z.enum(["NUTRITION", "HYDRATION", "ACTIVITY", "SLEEP", "WELLBEING", "WOMENS_HEALTH", "FAMILY", "LEARNING", "PROFESSIONAL"]);
const KIND = z.enum(["CHECK", "AMOUNT", "REFLECTION"]);

export const idParam = z.object({ id: z.string().min(1).max(40) });
export const todayQuery = z.object({ today: isoDay });
export const kindQuery = z.object({ kind: z.enum(["BASELINE", "FINAL"]).default("BASELINE") });

export const assessmentBody = z.object({
  kind: z.enum(["BASELINE", "FINAL"]),
  // Checked question by question in the service (questions.ts), which knows each question's type and range.
  answers: z.record(z.string().max(40), z.unknown()),
  submit: z.boolean(),
});

export const taskLogBody = z.object({
  date: isoDay,
  type: z.enum(["DONE", "SKIPPED", "NEED_HELP", "UNDONE"]),
  value: z.number().min(0).max(100_000).nullable().optional(),
  note: optionalWords(500),
});

const taskFields = {
  templateId: z.string().min(1).max(40).nullable().optional(),
  title: words(120),
  category: CATEGORY,
  kind: KIND,
  unit: optionalWords(20),
  target: z.number().positive().max(100_000).nullable().optional(),
  instructions: words(1000),
  safetyNotes: optionalWords(500),
  frequency: z.enum(["DAILY", "WEEKDAYS", "ONCE"]),
  weekdays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  startDay: z.number().int().min(1).max(365),
  endDay: z.number().int().min(1).max(365),
};

export const addTaskBody = z.object(taskFields);
export const changeTaskBody = z.object({ ...taskFields, reason: optionalWords(300) });
export const taskStateBody = z.object({ action: z.enum(["pause", "resume", "stop"]), reason: words(300) });
export const publishBody = z.object({ reason: words(300) });
export const replyBody = z.object({ date: isoDay, note: words(800) });
export const reviewBody = z.object({ kind: z.enum(["WEEKLY", "FINAL"]), notes: words(2000), nextReviewOn: isoDay.nullable().optional() });

export const programmeBody = z.object({ name: words(80), summary: words(400), durationDays: z.number().int().min(7).max(365) });
export const programmeUpdateBody = z.object({
  name: words(80).optional(),
  summary: words(400).optional(),
  durationDays: z.number().int().min(7).max(365).optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "RETIRED"]).optional(),
});

const templateFields = {
  title: words(120),
  category: CATEGORY,
  kind: KIND,
  unit: optionalWords(20),
  instructions: words(1000),
  safetyNotes: optionalWords(500),
};
export const templateBody = z.object(templateFields).refine((t) => t.kind !== "AMOUNT" || !!t.unit, { message: "An amount task needs a unit.", path: ["unit"] });
export const templateUpdateBody = z.object({
  title: templateFields.title.optional(),
  category: CATEGORY.optional(),
  kind: KIND.optional(),
  // Left out = unchanged; empty = cleared.
  unit: z.string().trim().max(20).nullable().optional().transform((v) => (v === undefined ? undefined : v || null)),
  instructions: templateFields.instructions.optional(),
  safetyNotes: z.string().trim().max(500).nullable().optional().transform((v) => (v === undefined ? undefined : v || null)),
  status: z.enum(["DRAFT", "RETIRED"]).optional(),
});
export const approveBody = z.object({ reviewedBy: words(120) });
export const assignCoachBody = z.object({ coachId: z.string().min(1).max(40) });
