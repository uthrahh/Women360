import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Answers, IntakeField, RecallRow } from "@/types/clients";
import { shortDate } from "@/types/clients";
import { ChoiceRow } from "@/components/ui/ChoiceRow";
import { NumberField } from "@/components/ui/NumberField";
import { TextArea } from "@/components/ui/TextArea";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

function show(f: IntakeField, v: Answers[string] | undefined): string | null {
  if (v === undefined || v === "") return null;
  if (f.type === "number") return `${v}${f.unit ? " " + f.unit : ""}`;
  if (f.type === "date") return shortDate(String(v));
  if (f.type === "recall") return null;
  return String(v);
}

/**
 * One assessment section, read as a short list of answers, edited in place with the fields the server defines. Saving sends the
 * whole section; unanswered fields simply stay empty (nothing is filled in for her).
 */
export function IntakeSectionCard({ title, fields, answers, onSave }: { title: string; fields: IntakeField[]; answers: Answers; onSave: (a: Answers) => Promise<string | null> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Answers>(answers);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (id: string, v: Answers[string] | null) =>
    setDraft((d) => {
      const n = { ...d };
      if (v === null || v === "") delete n[id];
      else n[id] = v;
      return n;
    });
  const visible = (f: IntakeField, a: Answers) => !("showIf" in f && f.showIf) || a[f.showIf.field] === f.showIf.equals;
  const filled = fields.filter((f) => visible(f, answers) && answers[f.id] !== undefined);

  return (
    <section className="flex flex-col gap-3 border-t border-[var(--w360-border)] pt-5" aria-label={title}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-lg font-semibold">{title}</h3>
        {!editing && (
          <Button size="sm" variant="secondary" onClick={() => { setDraft(answers); setError(""); setEditing(true); }}>
            {filled.length ? "Edit" : "Fill in"}<span className="sr-only"> {title}</span>
          </Button>
        )}
      </div>

      {!editing &&
        (filled.length === 0 ? (
          <p className="text-sm text-[var(--w360-text-muted)]">Not recorded yet.</p>
        ) : (
          <dl className="grid sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
            {filled.map((f) =>
              f.type === "recall" ? (
                <div key={f.id} className="contents">
                  <dt className="text-[var(--w360-text-muted)]">{f.label}</dt>
                  <dd>
                    <ul className="flex flex-col gap-0.5">
                      {(answers[f.id] as RecallRow[]).map((r, i) => (
                        <li key={i}><span className="tabular-nums text-[var(--w360-text-muted)]">{r.time || "—"}</span> {r.food}</li>
                      ))}
                    </ul>
                  </dd>
                </div>
              ) : (
                <div key={f.id} className="contents">
                  <dt className="text-[var(--w360-text-muted)]">{f.label}</dt>
                  <dd className="whitespace-pre-line tabular-nums">{show(f, answers[f.id])}</dd>
                </div>
              )
            )}
          </dl>
        ))}

      {editing && (
        <form
          className="flex flex-col gap-5"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const problem = await onSave(draft);
            setBusy(false);
            if (problem) setError(problem);
            else setEditing(false);
          }}
        >
          {fields.filter((f) => visible(f, draft)).map((f) => (
            <Field key={f.id} f={f} value={draft[f.id]} onChange={(v) => set(f.id, v)} />
          ))}
          {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </form>
      )}
    </section>
  );
}

function Field({ f, value, onChange }: { f: IntakeField; value: Answers[string] | undefined; onChange: (v: Answers[string] | null) => void }) {
  switch (f.type) {
    case "choice":
      return <ChoiceRow label={f.label} optional={false} choices={f.options.map((o) => ({ value: o, label: o }))} value={typeof value === "string" ? value : null} onChange={onChange} />;
    case "number":
      return (
        <div className="max-w-xs">
          <NumberField label={f.label} suffix={f.unit} min={f.min} max={f.max} step={f.step} optional value={value === undefined ? "" : String(value)} onChange={(v) => onChange(v === "" ? null : Number(v))} />
        </div>
      );
    case "text":
      return <TextArea label={f.label} rows={f.long ? 3 : 2} maxLength={f.maxLength} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} />;
    case "date":
      return (
        <div className="max-w-xs">
          <Input label={f.label} type="date" value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value || null)} />
        </div>
      );
    case "recall": {
      const rows = Array.isArray(value) ? value : [];
      const update = (next: RecallRow[]) => onChange(next.length ? next : null);
      return (
        <fieldset className="flex flex-col gap-2 min-w-0">
          <legend className="text-sm font-medium mb-1">{f.label}</legend>
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-[6.5rem_minmax(0,1fr)_auto] gap-2 items-end">
              <Input label="Time" value={r.time} maxLength={40} placeholder="8 am" onChange={(e) => update(rows.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)))} />
              <Input label="What she ate or drank" value={r.food} maxLength={300} onChange={(e) => update(rows.map((x, j) => (j === i ? { ...x, food: e.target.value } : x)))} />
              <Button type="button" size="sm" variant="ghost" aria-label={`Remove entry ${i + 1}`} onClick={() => update(rows.filter((_, j) => j !== i))}>
                <Trash2 size={15} aria-hidden />
              </Button>
            </div>
          ))}
          {rows.length < 12 && (
            <Button type="button" size="sm" variant="secondary" className="self-start" onClick={() => update([...rows, { time: "", food: "" }])}>
              <Plus size={14} aria-hidden /> Add a meal or drink
            </Button>
          )}
        </fieldset>
      );
    }
  }
}
