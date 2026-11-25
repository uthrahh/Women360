import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import type { ActivityCategoryCode, ActivityTarget, ActivityTargets as Data } from "@/types";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { NumberField } from "@/components/ui/NumberField";
import { SegmentedChoice } from "@/components/ui/SegmentedChoice";
import { Hint } from "@/components/ui/Hint";
import { formatDuration } from "@/lib/activity";

interface Draft {
  category: ActivityCategoryCode;
  label: string;
  minutes: string;
  period: "DAY" | "WEEK";
  isNew: boolean;
}

/**
 * Minutes targets for one kind of movement: walking, cardio, strength, yoga and stretching, or physiotherapy. She picks which kinds
 * and how many minutes a day or a week. The minutes done are summed from her own logged activity (a week is Monday to Sunday), never
 * typed in twice. No amount is suggested here: the plan builder is where guideline numbers live, and it is only ever built on request.
 */
export function ActivityTargets({
  data,
  onSave,
  onRemove,
}: {
  data: Data;
  onSave: (category: ActivityCategoryCode, minutes: number, period: "DAY" | "WEEK") => Promise<boolean>;
  onRemove: (category: ActivityCategoryCode) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const open = (d: Draft) => {
    setError("");
    setDraft(d);
  };
  const forNew = (o: Data["available"][number]): Draft => ({ category: o.category, label: o.label, minutes: "", period: "WEEK", isNew: true });
  const forExisting = (t: ActivityTarget): Draft => ({ category: t.category, label: t.label, minutes: String(t.minutes), period: t.period, isNew: false });

  async function save() {
    if (!draft) return;
    const n = Number(draft.minutes);
    const most = draft.period === "DAY" ? 1440 : 10000;
    if (draft.minutes === "" || !Number.isInteger(n) || n < 1 || n > most) return setError(`Enter whole minutes, from 1 to ${most.toLocaleString()}.`);
    setError("");
    setSaving(true);
    const ok = await onSave(draft.category, n, draft.period);
    setSaving(false);
    if (ok) setDraft(null);
  }

  async function remove() {
    if (!draft) return;
    setSaving(true);
    const ok = await onRemove(draft.category);
    setSaving(false);
    if (ok) setDraft(null);
  }

  return (
    <section aria-labelledby="act-targets-heading">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 id="act-targets-heading" className="font-display text-lg font-semibold">Targets</h2>
        {data.available.length > 0 && (
          <Button variant="secondary" size="sm" onClick={() => open(forNew(data.available[0]))}>
            <Plus size={14} /> Add a target
          </Button>
        )}
      </div>
      {data.targets.length === 0 ? (
        <p className="text-sm text-[var(--w360-text-muted)] measure">
          Choose how many minutes of walking, cardio, strength, yoga or physiotherapy you want, a day or a week. What you log here counts toward it.
        </p>
      ) : (
        <>
          <Hint id="act-targets" className="text-xs text-[var(--w360-text-muted)] mb-3">Select a target to change it. A week runs Monday to Sunday.</Hint>
          <ul className="flex flex-col gap-3">
            {data.targets.map((t) => (
              <li key={t.category}>
                <button
                  type="button"
                  onClick={() => open(forExisting(t))}
                  aria-label={`${t.label}: ${formatDuration(t.done)} of ${formatDuration(t.minutes)} ${t.period === "DAY" ? "today" : "this week"}. Change this target`}
                  className="w-full text-left rounded p-2 -m-2 hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-colors duration-150"
                >
                  <span className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium">{t.label}</span>
                    <span className="tabular-nums text-[var(--w360-text-muted)] flex items-center gap-1.5">
                      {formatDuration(t.done)} of {formatDuration(t.minutes)} {t.period === "DAY" ? "today" : "this week"}
                      <Pencil size={12} aria-hidden="true" />
                    </span>
                  </span>
                  <ProgressBar value={(t.done / t.minutes) * 100} label={`${t.label} ${t.period === "DAY" ? "today" : "this week"}`} className="mt-1.5" />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

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
                <label htmlFor="act-target-kind" className="text-sm font-medium senior:text-lg">Kind of activity</label>
                <select
                  id="act-target-kind"
                  value={draft.category}
                  onChange={(e) => {
                    const o = data.available.find((a) => a.category === e.target.value);
                    if (o) setDraft((d) => (d ? { ...d, category: o.category, label: o.label } : d));
                  }}
                  className="px-3.5 py-2.5 rounded border border-[var(--w360-border)] bg-[var(--w360-bg-raised)] text-[var(--w360-text)] text-sm senior:text-lg senior:py-3.5"
                >
                  {data.available.map((o) => <option key={o.category} value={o.category}>{o.label}</option>)}
                </select>
              </div>
            )}
            <SegmentedChoice
              label="How often"
              options={[
                { value: "DAY", label: "Each day" },
                { value: "WEEK", label: "Each week" },
              ]}
              value={draft.period}
              onChange={(period) => setDraft((d) => (d ? { ...d, period } : d))}
            />
            <NumberField
              label="Minutes"
              suffix="min"
              max={draft.period === "DAY" ? 1440 : 10000}
              step={5}
              startAt={draft.period === "DAY" ? 30 : 150}
              value={draft.minutes}
              onChange={(v) => setDraft((d) => (d ? { ...d, minutes: v } : d))}
              error={error}
            />
            {draft.category === "PHYSIO" && (
              <p className="text-xs text-[var(--w360-text-muted)]">Use the amount your physiotherapist set. Physiotherapy minutes have no calorie estimate.</p>
            )}
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save target"}</Button>
            {!draft.isNew && <Button type="button" variant="secondary" onClick={remove} disabled={saving}>Remove this target</Button>}
          </form>
        )}
      </Modal>
    </section>
  );
}
