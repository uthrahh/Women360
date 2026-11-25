import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import type { NutrientOption, NutrientTarget, NutrientTargets as Data } from "@/types";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { NumberField } from "@/components/ui/NumberField";
import { SegmentedChoice } from "@/components/ui/SegmentedChoice";
import { Hint } from "@/components/ui/Hint";

/** Protein, fibre, water and fruit and veg always have a target; everything else is added when she chooses. */
const ALWAYS_ON = new Set(["protein", "fibre", "water", "fruitveg"]);
/** Water and fruit and veg already have their own cards with a tap to add; their targets are changed from there. */
const HAS_OWN_CARD = new Set(["water", "fruitveg"]);

const fmt = (n: number) => (Number.isInteger(n) ? n.toLocaleString() : String(n));

interface Draft {
  code: string;
  label: string;
  unit: string;
  group: "main" | "micro";
  amount: string;
  mode: "AT_LEAST" | "AT_MOST";
  isNew: boolean;
}

const draftFrom = (t: NutrientTarget): Draft => ({ code: t.code, label: t.label, unit: t.unit, group: t.group, amount: String(t.amount), mode: t.mode, isNew: false });
const draftForNew = (o: NutrientOption): Draft => ({ code: o.code, label: o.label, unit: o.unit, group: o.group, amount: "", mode: o.usuallyAtMost ? "AT_MOST" : "AT_LEAST", isNew: true });

/**
 * "Targets": a daily amount she chooses for any macro or micronutrient, with today's total beside it. Plain progress bars, never red or
 * green and never a verdict: a target is a number she set, not a grade. There are no suggested amounts for vitamins and minerals (that is a
 * medical claim that depends on her age, pregnancy and conditions), so she types what her doctor or dietitian gave her.
 */
export function NutrientTargets({
  data,
  onSave,
  onRemove,
  editRequest,
}: {
  data: Data;
  onSave: (code: string, amount: number, mode: "AT_LEAST" | "AT_MOST") => Promise<boolean>;
  onRemove: (code: string) => Promise<boolean>;
  /** Set by a card elsewhere on the page ("change" next to the water goal) to open the editor on that nutrient. */
  editRequest?: string | null;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastRequest, setLastRequest] = useState<string | null>(null);

  // A card elsewhere asked to edit one target (the request string carries a counter so the same nutrient can be asked twice).
  if (editRequest && editRequest !== lastRequest) {
    setLastRequest(editRequest);
    const target = data.targets.find((t) => t.code === editRequest.split(":")[0]);
    if (target) setDraft(draftFrom(target));
  }

  const rows = data.targets.filter((t) => !HAS_OWN_CARD.has(t.code));
  const whole = (unit: string) => unit === "ml" || unit === "servings";

  async function save() {
    if (!draft) return;
    const n = Number(draft.amount);
    if (draft.amount === "" || Number.isNaN(n) || n <= 0) return setError("Enter an amount above 0.");
    if (whole(draft.unit) ? !Number.isInteger(n) : Math.round(n * 100) % 10 !== 0) return setError(whole(draft.unit) ? "Use a whole number." : "Use at most one decimal place, e.g. 12 or 12.3.");
    setError("");
    setSaving(true);
    const ok = await onSave(draft.code, n, draft.mode);
    setSaving(false);
    if (ok) setDraft(null);
  }

  async function remove() {
    if (!draft) return;
    setSaving(true);
    const ok = await onRemove(draft.code);
    setSaving(false);
    if (ok) setDraft(null);
  }

  const setDraftAndClear = (d: Draft) => {
    setError("");
    setDraft(d);
  };

  const pick = (code: string) => {
    const option = data.available.find((o) => o.code === code);
    if (option) setDraft(draftForNew(option));
  };

  return (
    <section aria-labelledby="targets-heading">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 id="targets-heading" className="font-display text-lg font-semibold">Targets</h2>
        {data.available.length > 0 && (
          <Button variant="secondary" size="sm" onClick={() => setDraftAndClear(draftForNew(data.available[0]))}>
            <Plus size={14} /> Add a target
          </Button>
        )}
      </div>
      <Hint id="nutr-targets" className="text-xs text-[var(--w360-text-muted)] mb-3">
        A target is a daily amount you choose. Select one to change it. Your day's total comes from the meals you log.
      </Hint>
      <ul className="flex flex-col gap-3">
        {rows.map((t) => {
          const atMost = t.mode === "AT_MOST";
          return (
            <li key={t.code}>
              <button
                type="button"
                onClick={() => setDraftAndClear(draftFrom(t))}
                aria-label={`${t.label}: ${fmt(t.total)} of ${fmt(t.amount)} ${t.unit}${atMost ? " maximum" : ""}. Change this target`}
                className="w-full text-left rounded p-2 -m-2 hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-colors duration-150"
              >
                <span className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium">{t.label}</span>
                  <span className="tabular-nums text-[var(--w360-text-muted)] flex items-center gap-1.5">
                    {fmt(t.total)} {atMost ? "of up to" : "of"} {fmt(t.amount)} {t.unit}
                    <Pencil size={12} aria-hidden="true" />
                  </span>
                </span>
                <ProgressBar value={t.amount > 0 ? (t.total / t.amount) * 100 : 0} tone={atMost ? "neutral" : "accent"} label={`${t.label} today`} className="mt-1.5" />
              </button>
            </li>
          );
        })}
      </ul>

      <Modal open={draft !== null} onClose={() => setDraft(null)} title={draft?.isNew ? "Add a target" : `${draft?.label ?? ""} target`} size="sm">
        {draft && (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            {draft.isNew && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="target-nutrient" className="text-sm font-medium senior:text-lg">Nutrient</label>
                <select
                  id="target-nutrient"
                  value={draft.code}
                  onChange={(e) => pick(e.target.value)}
                  className="px-3.5 py-2.5 rounded border border-[var(--w360-border)] bg-[var(--w360-bg-raised)] text-[var(--w360-text)] text-sm senior:text-lg senior:py-3.5"
                >
                  <optgroup label="Macros and basics">
                    {data.available.filter((o) => o.group === "main").map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
                  </optgroup>
                  <optgroup label="Vitamins and minerals">
                    {data.available.filter((o) => o.group === "micro").map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
                  </optgroup>
                </select>
              </div>
            )}
            <NumberField
              label={`Amount per day${draft.unit ? ` (${draft.unit})` : ""}`}
              suffix={draft.unit}
              max={whole(draft.unit) ? 6000 : 20000}
              step={whole(draft.unit) ? 50 : 1}
              value={draft.amount}
              onChange={(v) => setDraft((d) => (d ? { ...d, amount: v } : d))}
              error={error}
            />
            {!ALWAYS_ON.has(draft.code) && (
              <SegmentedChoice
                label="This is an amount to"
                options={[
                  { value: "AT_LEAST", label: "Reach at least" },
                  { value: "AT_MOST", label: "Stay under" },
                ]}
                value={draft.mode}
                onChange={(mode) => setDraft((d) => (d ? { ...d, mode } : d))}
              />
            )}
            {draft.group === "micro" && (
              <p className="text-xs text-[var(--w360-text-muted)]">
                Women360 doesn't suggest an amount for vitamins and minerals: the right one depends on your age, pregnancy and health. Use the number your doctor or dietitian gave you.
              </p>
            )}
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save target"}</Button>
            {!draft.isNew && !ALWAYS_ON.has(draft.code) && (
              <Button type="button" variant="secondary" onClick={remove} disabled={saving}>Remove this target</Button>
            )}
          </form>
        )}
      </Modal>
    </section>
  );
}
