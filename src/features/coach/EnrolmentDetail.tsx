import { useCallback, useEffect, useState } from "react";
import { coachProgrammeService } from "@/services/programmeService";
import type { CoachEnrolment, ProgrammeTask, Question, TaskTemplate } from "@/types/programme";
import { CATEGORY_LABEL, STATUS_LABEL, answerText, scheduleText } from "@/types/programme";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { TextArea } from "@/components/ui/TextArea";
import { Input } from "@/components/ui/Input";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useToast } from "@/components/ui/Toast";
import { TaskEditor } from "./TaskEditor";

const shortDate = (iso: string) => new Date(iso.length === 10 ? iso + "T00:00:00" : iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
const STATE_TEXT = { open: "Not reported", done: "Done", skipped: "Skipped", help: "Asked for help" } as const;

/** One person's programme as her coach sees it: her answers, the plan (draft and published), her last week, help requests and reviews. */
export function EnrolmentDetail({ enrolmentId, onChanged }: { enrolmentId: string; onChanged: () => void }) {
  const [d, setD] = useState<CoachEnrolment | null>(null);
  const [failed, setFailed] = useState(false);
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [editing, setEditing] = useState<ProgrammeTask | "new" | null>(null);
  const [stateChange, setStateChange] = useState<{ task: ProgrammeTask; action: "pause" | "resume" | "stop" } | null>(null);
  const [publishing, setPublishing] = useState(false);
  const toast = useToast();

  const load = useCallback(() => {
    setFailed(false);
    coachProgrammeService.detail(enrolmentId).then(setD).catch(() => setFailed(true));
  }, [enrolmentId]);
  useEffect(() => {
    load();
    coachProgrammeService.templates(enrolmentId).then(setTemplates).catch(() => setTemplates([]));
    // The final questions include every compared one, the starting ones the rest; together they label all of her answers.
    Promise.all([coachProgrammeService.questions("BASELINE"), coachProgrammeService.questions("FINAL")]).then(([b, f]) => {
      const all = [...(b?.questions ?? []), ...(f?.questions ?? [])];
      setQuestions(all.filter((q, i) => all.findIndex((x) => x.id === q.id) === i));
    });
  }, [enrolmentId, load]);

  if (failed) return <ErrorState title="Couldn't load this programme" onRetry={load} />;
  if (!d) return <LoadingState variant="rows" />;

  const refresh = () => {
    load();
    onChanged();
  };
  const fail = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);
  const drafts = d.tasks.filter((t) => !t.published);
  const live = d.tasks.filter((t) => t.published && (t.status === "ACTIVE" || t.status === "PAUSED"));
  const earlier = d.tasks.filter((t) => t.published && (t.status === "STOPPED" || t.status === "REPLACED"));
  const canPlan = d.status === "PLANNING" || d.status === "ACTIVE";

  return (
    <div className="flex flex-col gap-8 min-w-0">
      <header>
        <h2 className="font-display text-2xl font-semibold">{d.name}</h2>
        <p className="text-sm text-[var(--w360-text-muted)] mt-1">
          {d.programme.name} · {STATUS_LABEL[d.status]}
          {d.day !== null && ` · Day ${d.day} of ${d.programme.durationDays}`}
          {d.planVersion > 0 && ` · Plan version ${d.planVersion}`}
        </p>
        {d.progress && d.progress.due > 0 && (
          <p className="text-sm mt-1 tabular-nums">{d.progress.done} of {d.progress.due} tasks done, {d.progress.skipped} skipped, active on {d.progress.activeDays} days.</p>
        )}
      </header>

      {d.helpRequests.length > 0 && (
        <section aria-labelledby="help-h" className="flex flex-col gap-3">
          <h3 id="help-h" className="font-display text-lg font-semibold">Waiting for your reply</h3>
          <ul className="flex flex-col gap-4">
            {d.helpRequests.map((h) => (
              <HelpReply key={h.taskId + h.date} request={h} onSent={refresh} />
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="plan-h" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="plan-h" className="font-display text-lg font-semibold">Plan</h3>
          {canPlan && (
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setEditing("new")}>Add a task</Button>
              {drafts.length > 0 && <Button size="sm" onClick={() => setPublishing(true)}>{d.planVersion === 0 ? "Publish the plan" : `Publish ${drafts.length} new`}</Button>}
            </div>
          )}
        </div>
        {!canPlan && d.status === "ASSESSING" && <p className="text-sm text-[var(--w360-text-muted)]">She is still answering her starting questions. You can build the plan once they're in.</p>}
        {drafts.length + live.length === 0 && canPlan && <p className="text-sm text-[var(--w360-text-muted)]">No tasks yet. Add the first from the library or write your own.</p>}
        <ul className="flex flex-col divide-y divide-[var(--w360-border)] border-y border-[var(--w360-border)]">
          {[...drafts, ...live].map((t) => (
            <li key={t.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
              <div className="min-w-0">
                <p className="font-medium">
                  {t.title} {!t.published && <Badge tone="warning">Draft</Badge>} {t.status === "PAUSED" && <Badge>Paused</Badge>}
                </p>
                <p className="text-xs text-[var(--w360-text-muted)]">
                  {CATEGORY_LABEL[t.category]} · {scheduleText(t, d.programme.durationDays)}
                  {t.kind === "AMOUNT" && t.target !== null && ` · aim ${t.target} ${t.unit ?? ""}`}
                </p>
              </div>
              {canPlan && (
                <div className="flex flex-wrap gap-1.5 shrink-0">
                  {t.status === "ACTIVE" && <Button size="sm" variant="ghost" onClick={() => setEditing(t)}>{t.published ? "Change" : "Edit"}</Button>}
                  {!t.published && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        try {
                          await coachProgrammeService.deleteDraft(t.id);
                          refresh();
                        } catch (err) {
                          toast.show(fail(err, "Couldn't remove it."), { tone: "error" });
                        }
                      }}
                    >
                      Remove
                    </Button>
                  )}
                  {t.published && t.status === "ACTIVE" && <Button size="sm" variant="ghost" onClick={() => setStateChange({ task: t, action: "pause" })}>Pause</Button>}
                  {t.published && t.status === "PAUSED" && <Button size="sm" variant="ghost" onClick={() => setStateChange({ task: t, action: "resume" })}>Resume</Button>}
                  {t.published && <Button size="sm" variant="ghost" onClick={() => setStateChange({ task: t, action: "stop" })}>Stop</Button>}
                </div>
              )}
            </li>
          ))}
        </ul>
        {earlier.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer text-[var(--w360-text-muted)]">Earlier versions of tasks ({earlier.length})</summary>
            <ul className="mt-2 flex flex-col gap-1">
              {earlier.map((t) => (
                <li key={t.id}>{t.title}: {t.status === "STOPPED" ? "stopped" : "replaced"}{t.endedOnDay !== null && ` after day ${t.endedOnDay}`}</li>
              ))}
            </ul>
          </details>
        )}
        {d.changes.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer text-[var(--w360-text-muted)]">Plan versions ({d.changes.length})</summary>
            <ul className="mt-2 flex flex-col gap-1">
              {d.changes.map((c) => (
                <li key={c.version} className="tabular-nums">Version {c.version}, {shortDate(c.at)}: {c.reason}</li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {d.recent.length > 0 && (
        <section aria-labelledby="week-h" className="flex flex-col gap-3">
          <h3 id="week-h" className="font-display text-lg font-semibold">Her last 7 days</h3>
          <ul className="flex flex-col gap-3 text-sm">
            {d.recent.map((day) => (
              <li key={day.date}>
                <p className="font-medium tabular-nums">Day {day.day}, {shortDate(day.date)}</p>
                {day.items.length === 0 ? (
                  <p className="text-[var(--w360-text-muted)]">Nothing planned</p>
                ) : (
                  <ul className="text-[var(--w360-text-muted)]">
                    {day.items.map((i) => (
                      <li key={i.taskId}>
                        {i.title}: <span className={i.state.status === "done" ? "text-[var(--w360-text)]" : undefined}>{STATE_TEXT[i.state.status]}</span>
                        {i.state.value !== null && ` (${i.state.value})`}
                        {i.state.note && ` · “${i.state.note}”`}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <Answers title="Her starting answers" data={d.baseline} questions={questions} />
      {d.final && <Answers title="Her final answers" data={d.final} questions={questions} />}

      <Reviews d={d} onSaved={refresh} />

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Add a task" : editing?.published ? "Change a published task" : "Edit task"}>
        {editing !== null && (
          <TaskEditor
            durationDays={d.programme.durationDays}
            templates={templates}
            existing={editing === "new" ? undefined : editing}
            onSave={async (task) => {
              try {
                if (editing === "new") await coachProgrammeService.addTask(d.id, task);
                else await coachProgrammeService.changeTask(editing.id, task);
                setEditing(null);
                toast.show(editing !== "new" && editing.published ? "Changed. She's been told." : "Saved");
                refresh();
                return null;
              } catch (err) {
                return fail(err, "Couldn't save the task.");
              }
            }}
          />
        )}
      </Modal>

      <ReasonDialog
        open={publishing}
        title={d.planVersion === 0 ? "Publish her plan" : "Publish the new tasks"}
        label="A short note for her"
        initial={d.planVersion === 0 ? "Your first plan" : ""}
        confirm="Publish"
        onClose={() => setPublishing(false)}
        onConfirm={async (reason) => {
          try {
            await coachProgrammeService.publish(d.id, reason);
            setPublishing(false);
            toast.show("Published. She's been told.");
            refresh();
            return null;
          } catch (err) {
            return fail(err, "Couldn't publish.");
          }
        }}
      />
      <ReasonDialog
        open={stateChange !== null}
        title={stateChange ? `${{ pause: "Pause", resume: "Resume", stop: "Stop" }[stateChange.action]} "${stateChange.task.title}"` : ""}
        label="Why (she reads this)"
        initial=""
        confirm={stateChange ? { pause: "Pause", resume: "Resume", stop: "Stop" }[stateChange.action] : ""}
        onClose={() => setStateChange(null)}
        onConfirm={async (reason) => {
          if (!stateChange) return null;
          try {
            await coachProgrammeService.setState(stateChange.task.id, stateChange.action, reason);
            setStateChange(null);
            refresh();
            return null;
          } catch (err) {
            return fail(err, "Couldn't change the task.");
          }
        }}
      />
    </div>
  );
}

function ReasonDialog({ open, title, label, initial, confirm, onClose, onConfirm }: {
  open: boolean; title: string; label: string; initial: string; confirm: string; onClose: () => void; onConfirm: (reason: string) => Promise<string | null>;
}) {
  const [reason, setReason] = useState(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setReason(initial);
      setError("");
    }
  }, [open, initial]);
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!reason.trim()) return setError("Write a few words for her.");
          setBusy(true);
          const problem = await onConfirm(reason.trim());
          setBusy(false);
          if (problem) setError(problem);
        }}
      >
        <TextArea label={label} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} rows={2} error={error} />
        <Button type="submit" disabled={busy}>{busy ? "Saving…" : confirm}</Button>
      </form>
    </Modal>
  );
}

function HelpReply({ request, onSent }: { request: CoachEnrolment["helpRequests"][number]; onSent: () => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  return (
    <li className="flex flex-col gap-2">
      <p className="text-sm">
        <span className="font-medium">{request.title}</span>, {shortDate(request.date)}
        {request.note ? <span className="block text-[var(--w360-text-muted)]">“{request.note}”</span> : <span className="block text-[var(--w360-text-muted)]">She didn't add a note.</span>}
      </p>
      <form
        className="flex flex-col gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!note.trim()) return;
          setBusy(true);
          try {
            await coachProgrammeService.reply(request.taskId, request.date, note.trim());
            toast.show("Reply sent");
            onSent();
          } catch (err) {
            toast.show(err instanceof Error ? err.message : "Couldn't send.", { tone: "error" });
          } finally {
            setBusy(false);
          }
        }}
      >
        <TextArea label={`Reply about ${request.title}`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={800} rows={2} />
        <Button type="submit" size="sm" disabled={busy || !note.trim()} className="self-start">Send reply</Button>
      </form>
    </li>
  );
}

function Answers({ title, data, questions }: { title: string; data: CoachEnrolment["baseline"]; questions: Question[] }) {
  if (!data) return null;
  const ids = Object.keys(data.answers);
  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <dl className="grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
        {ids.map((id) => {
          const q = questions.find((x) => x.id === id);
          return (
            <div key={id} className="contents">
              <dt className="text-[var(--w360-text-muted)]">{q?.label ?? id}</dt>
              <dd className="whitespace-pre-line">{answerText(q, data.answers[id])}</dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

function Reviews({ d, onSaved }: { d: CoachEnrolment; onSaved: () => void }) {
  const [notes, setNotes] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const kind = d.status === "FINAL_REVIEW" ? "FINAL" : d.status === "ACTIVE" ? "WEEKLY" : null;

  return (
    <section aria-labelledby="rev-h" className="flex flex-col gap-3">
      <h3 id="rev-h" className="font-display text-lg font-semibold">Reviews</h3>
      {d.nextReviewOn && <p className="text-sm">Next review: {shortDate(d.nextReviewOn)}</p>}
      {d.reviews.map((r) => (
        <blockquote key={r.at} className="border-l-2 border-[var(--w360-border)] pl-3 text-sm">
          <p className="whitespace-pre-line">{r.notes}</p>
          <footer className="text-xs text-[var(--w360-text-muted)] mt-1">{r.kind === "FINAL" ? "Final review" : "Weekly review"}, {shortDate(r.at)}</footer>
        </blockquote>
      ))}
      {kind && (
        <form
          className="flex flex-col gap-3 max-w-xl"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!notes.trim()) return setError("Write your review first.");
            setBusy(true);
            setError("");
            try {
              await coachProgrammeService.review(d.id, kind, notes.trim(), kind === "WEEKLY" && next ? next : null);
              setNotes("");
              setNext("");
              toast.show(kind === "FINAL" ? "Programme completed. She's been told." : "Review saved. She's been told.");
              onSaved();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Couldn't save the review.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <TextArea
            label={kind === "FINAL" ? "Final review" : "This week's review"}
            note="She reads this. Keep it to what she did and what's next: no diagnosis or medical advice."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={2000}
            error={error}
          />
          {kind === "WEEKLY" && <Input type="date" label="Next review (optional)" value={next} onChange={(e) => setNext(e.target.value)} />}
          <Button type="submit" disabled={busy} className="self-start">{kind === "FINAL" ? "Save and complete the programme" : "Save the review"}</Button>
        </form>
      )}
    </section>
  );
}
