import type { Effort } from "@/types";

/** "30 min", "1 h", "1 h 5 min". */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** The same estimate the server makes (MET x kilograms x hours), for the live preview while she fills the form in. */
export function estimateCalories(met: number | undefined, weightKg: number | null, minutes: number): number | null {
  if (met === undefined || weightKg === null || !(weightKg > 0) || !(minutes > 0)) return null;
  return Math.round(met * weightKg * (minutes / 60));
}

/** The server's effort key ("MODERATE") as the front end writes it ("moderate"). */
export const effortOf = (key: string): Effort => key.toLowerCase() as Effort;

/** The key the duplicate check compares: the same activity, length and effort is the same shortcut. */
export const shortcutKey = (activityCode: string, minutes: number, effort: Effort) => `${activityCode}|${minutes}|${effort}`;

/** What the person has chosen so far in the activity form. Empty strings and null mean "not entered", never a default she didn't pick. */
export interface FieldsValue {
  code: string;
  effort: Effort | "";
  minutes: number | null;
  distance: string;
  sets: string;
}

export const emptyFields = (): FieldsValue => ({ code: "", effort: "", minutes: null, distance: "", sets: "" });
