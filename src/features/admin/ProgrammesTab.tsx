import { useCallback, useEffect, useState } from "react";
import { adminProgrammeService } from "@/services/programmeService";
import type { AdminEnrolment, AdminProgramme, TaskCategory, TaskKind, TaskTemplate } from "@/types/programme";
import { CATEGORY_LABEL, STATUS_LABEL } from "@/types/programme";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { TextArea } from "@/components/ui/TextArea";
import { NumberField } from "@/components/ui/NumberField";
import { SegmentedChoice } from "@/components/ui/SegmentedChoice";
import { Modal } from "@/components/ui/Modal";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useToast } from "@/components/ui/Toast";

type Coach = { id: string; name: string; caseload: number };
const errText = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);
const selectClass = "px-3.5 py-2.5 rounded border border-[var(--w360-border)] bg-[var(--w360-bg-raised)] text-[var(--w360-text)] text-sm";

/**
 * Guided programmes, for administrators: who is waiting for a coach, the programmes on offer, and the task library coaches build
 * plans from. A template can be used only once someone has reviewed it, and the reviewer's name is recorded with it.
 */
export function ProgrammesTab({ readOnly }: { readOnly: boolean }) {
  const [data, setData] = useState<{ programmes: AdminProgramme[]; templates: TaskTemplate[]; enrolments: AdminEnrolment[]; coaches: Coach[] } | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    Promise.all([adminProgrammeService.programmes(), adminProgrammeService.templates(), adminProgrammeService.enrolments(), adminProgrammeService.coaches()])
      .then(([programmes, templates, enrolments, coaches]) => setData({ programmes, templates, enrolments, coaches }))
      .catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);

  if (failed) return <ErrorState title="Couldn't load programmes" onRetry={load} />;
  if (!data) return <LoadingState variant="rows" />;

  return (
    <div className="flex flex-col gap-10">
      {readOnly && <p className="text-sm text-[var(--w360-text-muted)]">This demonstration administrator can look but not change anything.</p>}
      <Participants enrolments={data.enrolments} coaches={data.coaches} readOnly={readOnly} onChanged={load} />
      <Programmes programmes={data.programmes} readOnly={readOnly} onChanged={load} />
      <Library templates={data.templates} readOnly={readOnly} onChanged={load} />
    </div>
  );
}

function Participants({ enrolments, coaches, readOnly, onChanged }: { enrolments: AdminEnrolment[]; coaches: Coach[]; readOnly: boolean; onChanged: () => void }) {
  const [pick, setPick] = useState<Record<string, string>>({});
  const toast = useToast();
  return (
    <section aria-labelledby="ap-part" className="flex flex-col gap-3">
      <h2 id="ap-part" className="font-display text-xl font-semibold">Participants</h2>
      {enrolments.length === 0 ? (
        <p className="text-sm text-[var(--w360-text-muted)]">No one is in a programme right now.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--w360-border)] border-y border-[var(--w360-border)]">
          {enrolments.map((e) => (
            <li key={e.id} className="py-3 flex flex-col md:flex-row md:items-center gap-2 justify-between">
              <div className="min-w-0">
                <p className="font-medium">{e.name}</p>
                <p className="text-xs text-[var(--w360-text-muted)]">
                  {e.programme} · {STATUS_LABEL[e.status]} · {e.coach ? `Coach: ${e.coach.name}` : "No coach yet"}
                </p>
              </div>
              {!readOnly && (
                <form
                  className="flex gap-2 items-center"
                  onSubmit={async (ev) => {
                    ev.preventDefault();
                    const coachId = pick[e.id];
                    if (!coachId) return;
                    try {
                      await adminProgrammeService.assignCoach(e.id, coachId);
                      toast.show("Coach assigned");
                      onChanged();
                    } catch (err) {
                      toast.show(errText(err, "Couldn't assign the coach."), { tone: "error" });
                    }
                  }}
                >
                  <label htmlFor={`coach-${e.id}`} className="sr-only">Coach for {e.name}</label>
                  <select id={`coach-${e.id}`} className={selectClass} value={pick[e.id] ?? ""} onChange={(ev) => setPick((p) => ({ ...p, [e.id]: ev.target.value }))}>
                    <option value="">{coaches.length === 0 ? "No coach accounts" : "Choose a coach"}</option>
                    {coaches.filter((c) => c.id !== e.coach?.id).map((c) => (
                      <option key={c.id} value={c.id}>{c.name} ({c.caseload})</option>
                    ))}
                  </select>
                  <Button type="submit" size="sm" variant="secondary" disabled={!pick[e.id]}>{e.coach ? "Reassign" : "Assign"}</Button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Programmes({ programmes, readOnly, onChanged }: { programmes: AdminProgramme[]; readOnly: boolean; onChanged: () => void }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", summary: "", durationDays: "30" });
  const [error, setError] = useState("");
  const toast = useToast();

  const setStatus = async (p: AdminProgramme, status: AdminProgramme["status"]) => {
    try {
      await adminProgrammeService.updateProgramme(p.id, { status });
      toast.show(status === "PUBLISHED" ? "Published: women can join it now" : status === "RETIRED" ? "Retired: no one new can join" : "Back to draft");
      onChanged();
    } catch (err) {
      toast.show(errText(err, "Couldn't change it."), { tone: "error" });
    }
  };

  return (
    <section aria-labelledby="ap-prog" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="ap-prog" className="font-display text-xl font-semibold">Programmes</h2>
        {!readOnly && <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>New programme</Button>}
      </div>
      {programmes.length === 0 ? (
        <p className="text-sm text-[var(--w360-text-muted)]">No programmes yet. Nothing is offered to women until one is published.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--w360-border)] border-y border-[var(--w360-border)]">
          {programmes.map((p) => (
            <li key={p.id} className="py-3 flex flex-col md:flex-row md:items-center gap-2 justify-between">
              <div className="min-w-0">
                <p className="font-medium">
                  {p.name} <Badge tone={p.status === "PUBLISHED" ? "success" : "neutral"}>{p.status === "PUBLISHED" ? "Published" : p.status === "RETIRED" ? "Retired" : "Draft"}</Badge>
                </p>
                <p className="text-xs text-[var(--w360-text-muted)] tabular-nums">{p.durationDays} days · {p.enrolments} joined</p>
              </div>
              {!readOnly && (
                <div className="flex gap-1.5">
                  {p.status !== "PUBLISHED" && <Button size="sm" variant="secondary" onClick={() => setStatus(p, "PUBLISHED")}>Publish</Button>}
                  {p.status === "PUBLISHED" && <Button size="sm" variant="ghost" onClick={() => setStatus(p, "RETIRED")}>Retire</Button>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <Modal open={adding} onClose={() => setAdding(false)} title="New programme" size="sm">
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            const days = Number(form.durationDays);
            if (!form.name.trim() || !form.summary.trim()) return setError("Give it a name and a one-line summary.");
            if (!(days >= 7 && days <= 365)) return setError("A programme runs from 7 to 365 days.");
            try {
              await adminProgrammeService.createProgramme({ name: form.name.trim(), summary: form.summary.trim(), durationDays: days });
              setAdding(false);
              setForm({ name: "", summary: "", durationDays: "30" });
              toast.show("Saved as a draft");
              onChanged();
            } catch (err) {
              setError(errText(err, "Couldn't save it."));
            }
          }}
        >
          <Input label="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} maxLength={80} />
          <TextArea label="Summary" note="What women read before they join." value={form.summary} onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))} maxLength={400} rows={2} />
          <NumberField label="Days" suffix="days" min={7} max={365} value={form.durationDays} onChange={(v) => setForm((f) => ({ ...f, durationDays: v }))} />
          {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <Button type="submit">Save as a draft</Button>
        </form>
      </Modal>
    </section>
  );
}

const blankTemplate = { title: "", category: "ACTIVITY" as TaskCategory, kind: "CHECK" as TaskKind, unit: "", instructions: "", safetyNotes: "" };

function Library({ templates, readOnly, onChanged }: { templates: TaskTemplate[]; readOnly: boolean; onChanged: () => void }) {
  const [editing, setEditing] = useState<TaskTemplate | "new" | null>(null);
  const [form, setForm] = useState(blankTemplate);
  const [approving, setApproving] = useState<TaskTemplate | null>(null);
  const [reviewer, setReviewer] = useState("");
  const [error, setError] = useState("");
  const toast = useToast();

  const open = (t: TaskTemplate | "new") => {
    setError("");
    setForm(t === "new" ? blankTemplate : { title: t.title, category: t.category, kind: t.kind, unit: t.unit ?? "", instructions: t.instructions, safetyNotes: t.safetyNotes ?? "" });
    setEditing(t);
  };

  return (
    <section aria-labelledby="ap-lib" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="ap-lib" className="font-display text-xl font-semibold">Task library</h2>
        {!readOnly && <Button size="sm" variant="secondary" onClick={() => open("new")}>New template</Button>}
      </div>
      <p className="text-sm text-[var(--w360-text-muted)] measure">
        Coaches build plans from approved templates. Approve one only after a qualified reviewer has read it; changing an approved template
        sends it back for review.
      </p>
      {templates.length === 0 ? (
        <p className="text-sm text-[var(--w360-text-muted)]">No templates yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--w360-border)] border-y border-[var(--w360-border)]">
          {templates.map((t) => (
            <li key={t.id} className="py-3 flex flex-col md:flex-row md:items-center gap-2 justify-between">
              <div className="min-w-0">
                <p className="font-medium">
                  {t.title}{" "}
                  <Badge tone={t.status === "APPROVED" ? "success" : t.status === "DRAFT" ? "warning" : "neutral"}>
                    {t.status === "APPROVED" ? "Approved" : t.status === "DRAFT" ? "Needs review" : "Retired"}
                  </Badge>
                </p>
                <p className="text-xs text-[var(--w360-text-muted)]">
                  {CATEGORY_LABEL[t.category]}
                  {t.reviewedBy && ` · Reviewed by ${t.reviewedBy}`}
                </p>
              </div>
              {!readOnly && t.status !== "RETIRED" && (
                <div className="flex gap-1.5">
                  <Button size="sm" variant="ghost" onClick={() => open(t)}>Edit</Button>
                  {t.status === "DRAFT" && <Button size="sm" variant="secondary" onClick={() => { setReviewer(""); setError(""); setApproving(t); }}>Approve</Button>}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      try {
                        await adminProgrammeService.updateTemplate(t.id, { status: "RETIRED" });
                        onChanged();
                      } catch (err) {
                        toast.show(errText(err, "Couldn't retire it."), { tone: "error" });
                      }
                    }}
                  >
                    Retire
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "New template" : "Edit template"}>
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            if (!form.title.trim() || !form.instructions.trim()) return setError("Give it a title and the instructions.");
            if (form.kind === "AMOUNT" && !form.unit.trim()) return setError("Say what the amount is counted in.");
            const body = { title: form.title.trim(), category: form.category, kind: form.kind, unit: form.kind === "AMOUNT" ? form.unit.trim() : null, instructions: form.instructions.trim(), safetyNotes: form.safetyNotes.trim() || null };
            try {
              if (editing === "new") await adminProgrammeService.createTemplate(body);
              else if (editing) await adminProgrammeService.updateTemplate(editing.id, body);
              setEditing(null);
              toast.show("Saved. It needs review before coaches can use it.");
              onChanged();
            } catch (err) {
              setError(errText(err, "Couldn't save it."));
            }
          }}
        >
          <Input label="Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} maxLength={120} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="tpl-category" className="text-sm font-medium">Kind of task</label>
            <select id="tpl-category" className={selectClass} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as TaskCategory }))}>
              {(Object.keys(CATEGORY_LABEL) as TaskCategory[]).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
            </select>
          </div>
          <SegmentedChoice<TaskKind>
            label="Reported as"
            options={[{ value: "CHECK", label: "Done or not" }, { value: "AMOUNT", label: "An amount" }, { value: "REFLECTION", label: "A few words" }]}
            value={form.kind}
            onChange={(kind) => setForm((f) => ({ ...f, kind }))}
          />
          {form.kind === "AMOUNT" && <Input label="Counted in" placeholder="minutes" value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} maxLength={20} />}
          <TextArea label="Instructions" value={form.instructions} onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))} maxLength={1000} />
          <TextArea label="Safety note" optional note="Shown above the task, always." value={form.safetyNotes} onChange={(e) => setForm((f) => ({ ...f, safetyNotes: e.target.value }))} maxLength={500} rows={2} />
          {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <Button type="submit">Save</Button>
        </form>
      </Modal>

      <Modal open={approving !== null} onClose={() => setApproving(null)} title="Approve template" size="sm">
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!approving) return;
            if (!reviewer.trim()) return setError("Enter who reviewed it.");
            try {
              await adminProgrammeService.approveTemplate(approving.id, reviewer.trim());
              setApproving(null);
              toast.show("Approved: coaches can use it now");
              onChanged();
            } catch (err) {
              setError(errText(err, "Couldn't approve it."));
            }
          }}
        >
          <p className="text-sm">“{approving?.title}”</p>
          <Input label="Reviewed by" hint="The name and role of the qualified person who checked it." hintAlways value={reviewer} onChange={(e) => setReviewer(e.target.value)} maxLength={120} error={error} />
          <Button type="submit">Approve</Button>
        </form>
      </Modal>
    </section>
  );
}
