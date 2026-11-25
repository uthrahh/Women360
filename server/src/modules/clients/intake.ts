/**
 * The assessment a coach fills in during a consultation, from the coach's own "Professional Nutrition Client Assessment Form"
 * (basic details and measurements are their own forms; these are the other sections). Served to the web app, which draws the form
 * from it, and checked here on every save. Every field is optional: a coach records what she was told. Versioned: change a field
 * and bump INTAKE_VERSION.
 *
 * Nothing here is scored or classified. It is the coach's professional record, in the client's own words where it is text.
 */

export const INTAKE_VERSION = 1;

type Base = { id: string; label: string };
export type Field =
  | (Base & { type: "choice"; options: string[]; showIf?: { field: string; equals: string } })
  | (Base & { type: "number"; min: number; max: number; step: number; unit?: string })
  | (Base & { type: "text"; maxLength: number; long?: boolean })
  | (Base & { type: "date" })
  | (Base & { type: "recall" });

export type IntakeSection = "lifestyle" | "medical" | "menstrual" | "dietary";

export const INTAKE: Record<IntakeSection, { title: string; fields: Field[] }> = {
  lifestyle: {
    title: "Lifestyle",
    fields: [
      { id: "activityLevel", label: "Physical activity level", type: "choice", options: ["Sedentary", "Lightly active", "Moderately active", "Very active"] },
      { id: "exerciseExperience", label: "Exercise experience", type: "choice", options: ["None", "Beginner", "Intermediate", "Advanced"] },
      { id: "occupationType", label: "Occupation type", type: "choice", options: ["Desk-based", "On their feet", "Physical work", "Shift work", "Not working"] },
      { id: "sleepHours", label: "Sleep duration", type: "number", min: 0, max: 16, step: 0.5, unit: "hours" },
      { id: "sleepQuality", label: "Sleep quality", type: "choice", options: ["Poor", "Fair", "Good"] },
      { id: "waterLitres", label: "Water intake", type: "number", min: 0, max: 10, step: 0.25, unit: "litres a day" },
      { id: "stressLevel", label: "Stress level", type: "choice", options: ["Low", "Moderate", "High"] },
    ],
  },
  medical: {
    title: "Medical history",
    fields: [
      { id: "mainGoal", label: "Chief complaint or main goal", type: "text", maxLength: 500, long: true },
      { id: "conditions", label: "Medical conditions", type: "text", maxLength: 500, long: true },
      { id: "surgeries", label: "Previous surgeries", type: "text", maxLength: 500 },
      { id: "familyHistory", label: "Family history", type: "text", maxLength: 500 },
      { id: "medications", label: "Current medications", type: "text", maxLength: 500 },
      { id: "supplements", label: "Supplements", type: "text", maxLength: 300 },
      { id: "allergies", label: "Allergies", type: "text", maxLength: 300 },
      { id: "foodAllergies", label: "Food allergies", type: "text", maxLength: 300 },
    ],
  },
  menstrual: {
    title: "Menstrual history",
    fields: [
      { id: "menarcheAge", label: "Age at first period", type: "number", min: 7, max: 25, step: 1, unit: "years" },
      { id: "cycleLength", label: "Cycle length", type: "number", min: 15, max: 120, step: 1, unit: "days" },
      { id: "periodLength", label: "Period length", type: "number", min: 1, max: 15, step: 1, unit: "days" },
      { id: "flow", label: "Flow", type: "choice", options: ["Light", "Moderate", "Heavy"] },
      { id: "cramps", label: "Menstrual cramps", type: "choice", options: ["Yes", "No"] },
      { id: "crampSeverity", label: "Cramp severity", type: "choice", options: ["Mild", "Moderate", "Severe"], showIf: { field: "cramps", equals: "Yes" } },
      { id: "lmp", label: "Last menstrual period (first day)", type: "date" },
      { id: "regularity", label: "Cycle", type: "choice", options: ["Regular", "Irregular"] },
      { id: "pcos", label: "PCOS / PCOD diagnosis", type: "choice", options: ["No", "Yes", "Not sure"] },
      { id: "pregnancyHistory", label: "Pregnancy history", type: "text", maxLength: 300 },
      { id: "menopause", label: "Menopause status", type: "choice", options: ["Not applicable", "Perimenopause", "Menopause", "Postmenopause"] },
    ],
  },
  dietary: {
    title: "Dietary assessment",
    fields: [
      { id: "foodPreference", label: "Food preference", type: "choice", options: ["Vegetarian", "Eggetarian", "Non-vegetarian", "Vegan", "Jain"] },
      { id: "mealsPerDay", label: "Meals a day", type: "number", min: 1, max: 10, step: 1 },
      { id: "eatingOut", label: "Eating out", type: "choice", options: ["Rarely", "1-2 times a week", "3-5 times a week", "Daily"] },
      { id: "cravings", label: "Cravings", type: "text", maxLength: 300 },
      { id: "snacking", label: "Snacking habits", type: "text", maxLength: 300 },
      { id: "breakfast", label: "Breakfast", type: "choice", options: ["Every day", "Sometimes", "Usually skips"] },
      { id: "teaCoffee", label: "Tea and coffee", type: "text", maxLength: 120 },
      { id: "alcohol", label: "Alcohol", type: "choice", options: ["Never", "Occasionally", "Weekly", "Daily"] },
      { id: "tobacco", label: "Smoking or tobacco", type: "choice", options: ["Never", "Former", "Current"] },
      { id: "recall24h", label: "24-hour dietary recall", type: "recall" },
    ],
  },
};

export const INTAKE_SECTIONS = Object.keys(INTAKE) as IntakeSection[];
type Value = string | number | { time: string; food: string }[];
export type SectionAnswers = Record<string, Value>;

const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + "T00:00:00Z"));
const decimals = (n: number) => (String(n).split(".")[1] ?? "").length;

/** Checks one section's answers. Unknown fields, wrong types and out-of-range numbers are refused; empty values are dropped. */
export function checkSection(section: IntakeSection, input: Record<string, unknown>): { ok: true; answers: SectionAnswers } | { ok: false; error: string } {
  const fields = INTAKE[section].fields;
  const byId = new Map(fields.map((f) => [f.id, f]));
  for (const k of Object.keys(input)) if (!byId.has(k)) return { ok: false, error: `"${k}" isn't part of this section.` };
  const out: SectionAnswers = {};
  for (const f of fields) {
    const v = input[f.id];
    if (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0)) continue;
    switch (f.type) {
      case "choice":
        if (typeof v !== "string" || !f.options.includes(v)) return { ok: false, error: `Choose from the list for "${f.label}".` };
        out[f.id] = v;
        break;
      case "number":
        if (typeof v !== "number" || !Number.isFinite(v) || v < f.min || v > f.max || decimals(v) > decimals(f.step) + 1) {
          return { ok: false, error: `"${f.label}" must be between ${f.min} and ${f.max}.` };
        }
        out[f.id] = v;
        break;
      case "text":
        if (typeof v !== "string") return { ok: false, error: `Use words for "${f.label}".` };
        if (v.trim().length > f.maxLength) return { ok: false, error: `Keep "${f.label}" under ${f.maxLength} characters.` };
        if (v.trim()) out[f.id] = v.trim();
        break;
      case "date":
        if (typeof v !== "string" || !isDay(v)) return { ok: false, error: `Use a date for "${f.label}".` };
        out[f.id] = v;
        break;
      case "recall": {
        if (!Array.isArray(v) || v.length > 12) return { ok: false, error: "The dietary recall takes up to 12 entries." };
        const rows: { time: string; food: string }[] = [];
        for (const r of v) {
          if (!r || typeof r !== "object") return { ok: false, error: "Each recall entry needs a time and what was eaten." };
          const { time, food } = r as { time?: unknown; food?: unknown };
          if (typeof time !== "string" || typeof food !== "string" || time.length > 40 || food.length > 300) return { ok: false, error: "Each recall entry needs a time and what was eaten." };
          if (food.trim()) rows.push({ time: time.trim(), food: food.trim() });
        }
        if (rows.length) out[f.id] = rows;
        break;
      }
    }
  }
  return { ok: true, answers: out };
}

/** Body mass index and waist-hip ratio, to one and two decimals. Numbers only: no category is attached (that would be a clinical claim). */
export function bmi(weightKg: number | null, heightCm: number | null): number | null {
  if (!weightKg || !heightCm || heightCm <= 0) return null;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}
export function waistHip(waistCm: number | null, hipCm: number | null): number | null {
  if (!waistCm || !hipCm || hipCm <= 0) return null;
  return Math.round((waistCm / hipCm) * 100) / 100;
}
