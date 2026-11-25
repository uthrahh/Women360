import { useState } from "react";
import type { ProgrammeTask, TaskCategory, TaskDraft, TaskFrequency, TaskKind, TaskTemplate } from "@/types/programme";
import { CATEGORY_LABEL, WEEKDAY_SHORT } from "@/types/programme";
import { Input } from "@/components/ui/Input";
import { TextArea } from "@/components/ui/TextArea";
import { NumberField } from "@/components/ui/NumberField";
import { SegmentedChoice } from "@/components/ui/SegmentedChoice";
import { MultiChoiceRow } from "@/components/ui/ChoiceRow";
import { Button } from "@/components/ui/Button";

interface Form {
  templateId: string | null;
  title: string;
  category: TaskCategory;
  kind: TaskKind;
  unit: string;
  target: string;
  instructions: string;
  safetyNotes: string;
  frequency: TaskFrequency;
  weekdays: string[];
  startDay: string;
  endDay: string;
  reason: string;
}

const fromTask = (t: ProgrammeTask): Form => ({
  templateId: null,
  title: t.title,
  category: t.category,
  kind: t.kind,
  unit: t.unit ?? "",
  target: t.target === null ? "" : String(t.target),
  instructions: t.instructions,
  safetyNotes: t.safetyNotes ?? "",
  frequency: t.frequency,
  weekdays: t.weekdays.map(String),
  startDay: String(t.startDay),
  endDay: String(t.endDay),
  reason: "",
});

/**
 * Adds a task to a plan or changes one. Starting from an approved template copies its words (the reviewed text); a coach can also
 * write her own. A change to a published task needs a reason, because she reads it.
 */
export function TaskEditor({
  durationDays,
  templates,
  existing,
  onSave,
}: {
  durationDays: number;
  templates: TaskTemplate[];
  existing?: ProgrammeTask;
  onSave: (task: TaskDraft & { reason?: string | null }) => Promise<string | null>;
}) {
  const blank: Form = {
    templateId: null, title: "", category: "ACTIVITY", kind: "CHECK", unit: "", target: "", instructions: "", safetyNotes: "",
    frequency: "DAILY", weekdays: [], startDay: "1", endDay: String(durationDays), reason: "",
  };
  const [f, setF] = useState<Form>(existing ? fromTask(existing) : blank);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const live = existing?.published === true;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  function applyTemplate(id: string) {
    const t = templates.find((x) => x.id === id);
    if (!t) return setF((x) => ({ ...x, templateId: null }));
    setF((x) => ({ ...x, templateId: t.id, title: t.title, category: t.category, kind: t.kind, unit: t.unit ?? "", instructions: t.instructions, safetyNotes: t.safetyNotes ?? "" }));
  }

  async function submit() {
    setError("");
    const startDay = Number(f.startDay);
    const endDay = f.frequency === "ONCE" ? startDay : Number(f.endDay);
    if (!f.title.trim() || !f.instructions.trim()) return setError("Give the task a title and say how to do it.");
    if (!(startDay >= 1 && endDay <= durationDays && endDay >= startDay)) return setError(`Days run from 1 to ${durationDays}, and the last can't be before the first.`);
    if (f.frequency === "WEEKDAYS" && f.weekdays.length === 0) return setError("Choose at least one day of the week.");
    if (f.kind === "AMOUNT" && !f.unit.trim()) return setError("Say what the amount is counted in, such as glasses or minutes.");
    if (live && !f.reason.trim()) return setError("Say why you're changing it: she'll read the reason.");
    setBusy(true);
    const problem = await onSave({
      templateId: f.templateId,
      title: f.title.trim(),
      category: f.category,
      kind: f.kind,
      unit: f.kind === "AMOUNT" ? f.unit.trim() : null,
      target: f.kind === "AMOUNT" && f.target !== "" ? Number(f.target) : null,
      instructions: f.instructions.trim(),
      safetyNotes: f.safetyNotes.trim() || null,
      frequency: f.frequency,
      weekdays: f.frequency === "WEEKDAYS" ? f.weekdays.map(Number) : [],
      startDay,
      endDay,
      ...(live ? { reason: f.reason.trim() } : {}),
    });
    setBusy(false);
    if (problem) setError(problem);
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {!existing && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="task-template" className="text-sm font-medium senior:text-lg">Start from</label>
          <select
            id="task-template"
            value={f.templateId ?? ""}
            onChange={(e) => applyTemplate(e.target.value)}
            className="px-3.5 py-2.5 rounded border border-[var(--w360-border)] bg-[var(--w360-bg-raised)] text-[var(--w360-text)] text-sm senior:text-lg"
          >
            <option value="">A task I write myself</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{CATEGORY_LABEL[t.category]}: {t.title}</option>
            ))}
          </select>
          {templates.length === 0 && <p className="text-xs text-[var(--w360-text-muted)]">No approved templates yet. An administrator adds them under Administration.</p>}
        </div>
      )}
      <Input label="Title" value={f.title} onChange={(e) => set("title", e.target.value)} maxLength={120} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="task-category" className="text-sm font-medium senior:text-lg">Kind of task</label>
        <select
          id="task-category"
          value={f.category}
          onChange={(e) => set("category", e.target.value as TaskCategory)}
          className="px-3.5 py-2.5 rounded border border-[var(--w360-border)] bg-[var(--w360-bg-raised)] text-[var(--w360-text)] text-sm senior:text-lg"
        >
          {(Object.keys(CATEGORY_LABEL) as TaskCategory[]).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
        </select>
      </div>
      <SegmentedChoice<TaskKind>
        label="She reports it as"
        options={[
          { value: "CHECK", label: "Done or not" },
          { value: "AMOUNT", label: "An amount" },
          { value: "REFLECTION", label: "A few words" },
        ]}
        value={f.kind}
        onChange={(v) => set("kind", v)}
      />
      {f.kind === "AMOUNT" && (
        <div className="flex flex-col gap-3">
          <Input label="Counted in" placeholder="minutes" value={f.unit} onChange={(e) => set("unit", e.target.value)} maxLength={20} />
          <NumberField label="Aim" suffix={f.unit || undefined} optional max={100000} value={f.target} onChange={(v) => set("target", v)} />
        </div>
      )}
      <TextArea label="How to do it" value={f.instructions} onChange={(e) => set("instructions", e.target.value)} maxLength={1000} />
      <TextArea label="Safety note" optional note="Shown to her above the task, always." value={f.safetyNotes} onChange={(e) => set("safetyNotes", e.target.value)} maxLength={500} rows={2} />
      <SegmentedChoice<TaskFrequency>
        label="How often"
        options={[
          { value: "DAILY", label: "Every day" },
          { value: "WEEKDAYS", label: "Some days" },
          { value: "ONCE", label: "Once" },
        ]}
        value={f.frequency}
        onChange={(v) => set("frequency", v)}
      />
      {f.frequency === "WEEKDAYS" && (
        <MultiChoiceRow label="On" choices={WEEKDAY_SHORT.map((d, i) => ({ value: String(i), label: d }))} value={f.weekdays} onChange={(v) => set("weekdays", v)} max={7} />
      )}
      <div className="flex flex-col gap-3">
        <NumberField label={f.frequency === "ONCE" ? "On day" : "From day"} min={1} max={durationDays} value={f.startDay} onChange={(v) => set("startDay", v)} />
        {f.frequency !== "ONCE" && <NumberField label="To day" min={1} max={durationDays} value={f.endDay} onChange={(v) => set("endDay", v)} />}
      </div>
      {live && <TextArea label="Why the change" note="She sees this with the change." value={f.reason} onChange={(e) => set("reason", e.target.value)} maxLength={300} rows={2} />}
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <Button type="submit" disabled={busy}>{busy ? "Saving…" : existing ? (live ? "Save the change" : "Save") : "Add to the plan"}</Button>
    </form>
  );
}
