// Mirrors CONTEXT_TAGS in server/src/modules/cycle/cycle.validation.ts — the
// backend rejects anything outside this list.
export const CONTEXT_TAG_OPTIONS = [
  { value: "stress", label: "Stress" },
  { value: "illness", label: "Illness" },
  { value: "travel", label: "Travel" },
  { value: "new_medication", label: "New medication" },
  { value: "contraception_change", label: "Birth control change" },
  { value: "intense_exercise", label: "Intense exercise" },
  { value: "weight_change", label: "Weight change" },
  { value: "sleep_disruption", label: "Poor sleep" },
] as const;

export function contextTagLabel(value: string): string {
  return CONTEXT_TAG_OPTIONS.find((o) => o.value === value)?.label ?? value;
}
