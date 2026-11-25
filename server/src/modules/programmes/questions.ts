/**
 * The questions a woman answers when she joins a guided programme (BASELINE) and at the end of it (FINAL).
 *
 * They are plain self-report about routine and readiness: no symptom, diagnosis, weight or medical history is asked,
 * and nothing here is scored into a "health score". The questions that appear in both are the only ones compared at
 * the end, so the comparison is like for like. The wording is the product's, not a clinical instrument's, and is
 * versioned: change a question and SCHEMA_VERSION goes up, so older answers are still read against the questions
 * they answered. The questions themselves await review by the health content lead (see docs/OPERATIONS.md).
 */

export const SCHEMA_VERSION = 1;

type Base = { id: string; label: string; required: boolean; inBaseline: boolean; inFinal: boolean; section: "goals" | "routine" | "you" };
export type Question =
  | (Base & { type: "multi"; options: { value: string; label: string }[]; maxPick: number })
  | (Base & { type: "choice"; options: { value: string; label: string }[] })
  | (Base & { type: "number"; min: number; max: number; unit?: string })
  | (Base & { type: "scale"; lowLabel: string; highLabel: string })
  | (Base & { type: "text"; maxLength: number });

const both = { inBaseline: true, inFinal: true };
const baselineOnly = { inBaseline: true, inFinal: false };

export const QUESTIONS: Question[] = [
  {
    id: "focus", section: "goals", type: "multi", required: true, maxPick: 3, ...baselineOnly,
    label: "What would you most like to work on this month? Pick up to three.",
    options: [
      { value: "eat_better", label: "Eating better" },
      { value: "move_more", label: "Moving more" },
      { value: "sleep_better", label: "Sleeping better" },
      { value: "stress_less", label: "Feeling less stressed" },
      { value: "cycle", label: "Understanding my cycle" },
      { value: "family", label: "Healthier habits at home" },
    ],
  },
  { id: "activeDays", section: "routine", type: "number", required: true, min: 0, max: 7, unit: "days", ...both,
    label: "Last week, on how many days did you move on purpose for 20 minutes or more?" },
  {
    id: "sleepHours", section: "routine", type: "choice", required: true, ...both,
    label: "On a usual night, how long do you sleep?",
    options: [
      { value: "lt5", label: "Under 5 hours" },
      { value: "5to6", label: "5 to 6 hours" },
      { value: "6to7", label: "6 to 7 hours" },
      { value: "7to8", label: "7 to 8 hours" },
      { value: "gt8", label: "Over 8 hours" },
    ],
  },
  {
    id: "homeMeals", section: "routine", type: "choice", required: true, ...both,
    label: "Last week, how many of your meals were cooked at home?",
    options: [
      { value: "few", label: "Almost none" },
      { value: "half", label: "About half" },
      { value: "most", label: "Most" },
      { value: "all", label: "Almost all" },
    ],
  },
  { id: "water", section: "routine", type: "number", required: true, min: 0, max: 20, unit: "glasses", ...both,
    label: "How many glasses of water do you drink on a usual day?" },
  { id: "energy", section: "you", type: "scale", required: true, lowLabel: "Very low", highLabel: "Very good", ...both,
    label: "How is your energy on most days?" },
  { id: "stress", section: "you", type: "scale", required: true, lowLabel: "Hardly any", highLabel: "A lot", ...both,
    label: "How stressed do you feel on most days?" },
  {
    id: "timePerDay", section: "you", type: "choice", required: true, ...baselineOnly,
    label: "How much time can you give this on a usual day?",
    options: [
      { value: "10", label: "10 minutes" },
      { value: "20", label: "20 minutes" },
      { value: "30", label: "30 minutes" },
      { value: "45", label: "45 minutes or more" },
    ],
  },
  { id: "food", section: "you", type: "text", required: false, maxLength: 300, ...baselineOnly,
    label: "Food you don't eat, and any food allergies" },
  { id: "limits", section: "you", type: "text", required: false, maxLength: 500, ...baselineOnly,
    label: "Anything that limits what you can do, such as an injury, a condition or your working hours" },
  { id: "readiness", section: "you", type: "scale", required: true, lowLabel: "Not yet", highLabel: "Very ready", ...both,
    label: "How ready do you feel to change one thing this month?" },
  { id: "forCoach", section: "you", type: "text", required: false, maxLength: 500, ...baselineOnly,
    label: "Anything you'd like your coach to know" },
  { id: "changed", section: "you", type: "text", required: false, maxLength: 800, inBaseline: false, inFinal: true,
    label: "What, if anything, changed for you over the programme?" },
];

export type Kind = "BASELINE" | "FINAL";
export const questionsFor = (kind: Kind) => QUESTIONS.filter((q) => (kind === "BASELINE" ? q.inBaseline : q.inFinal));
/** Asked at the start and the end, so the two answers can be set side by side. */
export const COMPARABLE = QUESTIONS.filter((q) => q.inBaseline && q.inFinal && q.type !== "text").map((q) => q.id);

export type Answers = Record<string, string | number | string[]>;

/**
 * Checks answers against the questions for that kind. A draft may leave questions out; a submission must answer every
 * required one. Unknown keys, wrong types and out-of-range values are refused either way. Returns the cleaned answers
 * (text trimmed, empty text dropped) or the first problem as a sentence.
 */
export function checkAnswers(kind: Kind, input: Record<string, unknown>, submitting: boolean): { ok: true; answers: Answers } | { ok: false; error: string } {
  const qs = questionsFor(kind);
  const byId = new Map(qs.map((q) => [q.id, q]));
  for (const key of Object.keys(input)) if (!byId.has(key)) return { ok: false, error: `"${key}" isn't one of the questions.` };
  const out: Answers = {};
  for (const q of qs) {
    const v = input[q.id];
    const missing = v === undefined || v === null || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0);
    if (missing) {
      if (submitting && q.required) return { ok: false, error: `Please answer: ${q.label}` };
      continue;
    }
    switch (q.type) {
      case "multi": {
        if (!Array.isArray(v) || !v.every((x) => typeof x === "string")) return { ok: false, error: `Choose from the list: ${q.label}` };
        const picked = [...new Set(v as string[])];
        if (picked.some((x) => !q.options.some((o) => o.value === x))) return { ok: false, error: `Choose from the list: ${q.label}` };
        if (picked.length > q.maxPick) return { ok: false, error: `Pick up to ${q.maxPick}.` };
        out[q.id] = picked;
        break;
      }
      case "choice":
        if (typeof v !== "string" || !q.options.some((o) => o.value === v)) return { ok: false, error: `Choose from the list: ${q.label}` };
        out[q.id] = v;
        break;
      case "number":
        if (typeof v !== "number" || !Number.isInteger(v) || v < q.min || v > q.max) return { ok: false, error: `Enter a whole number from ${q.min} to ${q.max}.` };
        out[q.id] = v;
        break;
      case "scale":
        if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > 5) return { ok: false, error: "Choose from 1 to 5." };
        out[q.id] = v;
        break;
      case "text":
        if (typeof v !== "string") return { ok: false, error: `Use words for: ${q.label}` };
        if (v.trim().length > q.maxLength) return { ok: false, error: `Keep it under ${q.maxLength} characters.` };
        out[q.id] = v.trim();
        break;
    }
  }
  return { ok: true, answers: out };
}
