import { z } from "zod";
import { ACTIVITY_CODES, activityByCode } from "./catalog";

const day = z.string().date();
const levelEnum = z.enum(["LOW", "MODERATE", "HIGH"]);

// The activity decides which efforts and which extra details are valid, so the
// checks that need both live in one refinement used by every schema that has them.
function checkAgainstCatalog(v: { activityCode?: string; intensity?: string; distanceKm?: number | null; sets?: number | null }, ctx: z.RefinementCtx) {
  if (!v.activityCode) return;
  const def = activityByCode(v.activityCode);
  if (!def) return;
  if (v.intensity && !def.levels[v.intensity as "LOW" | "MODERATE" | "HIGH"]) {
    ctx.addIssue({ code: "custom", path: ["intensity"], message: `${def.label} has no "${v.intensity.toLowerCase()}" effort level.` });
  }
  if (v.distanceKm != null && !def.extras.includes("distanceKm")) {
    ctx.addIssue({ code: "custom", path: ["distanceKm"], message: `Distance doesn't apply to ${def.label.toLowerCase()}.` });
  }
  if (v.sets != null && !def.extras.includes("sets")) {
    ctx.addIssue({ code: "custom", path: ["sets"], message: `Sets don't apply to ${def.label.toLowerCase()}.` });
  }
}

const entryFields = {
  date: day,
  activityCode: z.enum(ACTIVITY_CODES),
  durationMinutes: z.number().int().min(1).max(1440),
  intensity: levelEnum,
  distanceKm: z.number().positive().max(500).nullable().optional(),
  sets: z.number().int().min(1).max(200).nullable().optional(),
  notes: z.string().trim().max(500).optional(),
};

export const activityEntrySchema = z.object(entryFields).superRefine(checkAgainstCatalog);

// An edit may send only what changed; the service re-checks the merged result.
export const activityEntryUpdateSchema = z
  .object(entryFields)
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update.");

export const quickLogSchema = z
  .object({
    activityCode: z.enum(ACTIVITY_CODES),
    durationMinutes: z.number().int().min(1).max(1440),
    intensity: levelEnum,
  })
  .superRefine(checkAgainstCatalog);

export const stepsLogSchema = z.object({
  date: day,
  steps: z.number().int().min(0).max(200_000),
});

export const activityGoalSchema = z.object({
  stepsGoal: z.number().int().min(1000).max(50_000),
  activeMinutesGoal: z.number().int().min(5).max(600),
});

export const idParamSchema = z.object({ id: z.string().min(1) });
