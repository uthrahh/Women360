import { useCallback, useEffect, useState } from "react";
import { programmeService } from "@/services/programmeService";
import type { Answers, AssessmentKind, MyProgramme, ProgrammeSummary, Question } from "@/types/programme";
import { STATUS_LABEL, answerText } from "@/types/programme";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { Hint } from "@/components/ui/Hint";
import { useToast } from "@/components/ui/Toast";
import { Questionnaire } from "./Questionnaire";
import { TaskRow } from "./TaskRow";

const longDate = (iso: string) => new Date(iso.length === 10 ? iso + "T00:00:00" : iso).toLocaleDateString(undefined, { day: "numeric", month: "long" });

/**
 * A guided programme: she joins, answers a few questions, a coach builds her plan, and each day shows that day's tasks.
 * One screen, whose content follows where she is in the programme.
 */
export default function ProgrammePage() {
  const [data, setData] = useState<MyProgramme | null>(null);
  const [failed, setFailed] = useState(false);
  const [questions, setQuestions] = useState<Record<AssessmentKind, Question[] | null>>({ BASELINE: null, FINAL: null });
  const toast = useToast();

  const load = useCallback(() => {
    setFailed(false);
    programmeService
      .mine()
      .then(setData)
      .catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);

  // The questions are fetched when they are needed: while she answers, and for the final report's comparison.
  const status = data?.current?.status;
  const need: AssessmentKind | null = status === "ASSESSING" ? "BASELINE" : status === "FINAL_ASSESSMENT" || status === "COMPLETED" ? "FINAL" : null;
  useEffect(() => {
    if (!need || questions[need]) return;
    programmeService
      .questions(need)
      .then((q) => setQuestions((s) => ({ ...s, [need]: q.questions })))
      .catch(() => setFailed(true));
  }, [need, questions]);

  if (failed) return <ErrorState title="Couldn't load your programme" onRetry={load} />;
  if (!data) return <LoadingState />;

  const cur = data.current;
  const saveAnswers = (kind: AssessmentKind) => async (answers: Answers, submit: boolean) => {
    try {
      await programmeService.saveAnswers(kind, answers, submit);
      toast.show(submit ? "Sent to your coach" : "Saved. You can finish later.");
      if (submit) load();
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : "Couldn't save your answers. Please try again.";
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-3xl font-semibold">{cur && cur.status !== "COMPLETED" ? cur.programme.name : "Programme"}</h1>
        {cur && cur.status !== "COMPLETED" && (
          <p className="text-[var(--w360-text-muted)] mt-1">
            {cur.coach ? `With your coach, ${cur.coach.name}` : STATUS_LABEL[cur.status]}
            {cur.status === "ACTIVE" && cur.day !== null && ` · Day ${cur.day} of ${cur.programme.durationDays}`}
          </p>
        )}
      </header>

      {!cur && <Join programmes={data.available} onJoined={load} />}

      {cur?.status === "ASSESSING" &&
        (questions.BASELINE ? (
          <section aria-labelledby="q-heading" className="flex flex-col gap-4">
            <h2 id="q-heading" className="font-display text-xl font-semibold">A few questions to start</h2>
            <p className="text-sm text-[var(--w360-text-muted)] measure">
              Your coach reads these to build a plan that fits your week. They are about your routine, not your medical history, and they
              are not scored.
            </p>
            <Questionnaire kind="BASELINE" questions={questions.BASELINE} initial={(cur.baseline?.answers as Answers) ?? {}} onSave={saveAnswers("BASELINE")} />
          </section>
        ) : (
          <LoadingState variant="rows" />
        ))}

      {cur?.status === "WAITING_FOR_COACH" && (
        <Waiting title="Your answers are in" text="Women360 is matching you with a coach. You'll get a notification when your coach is assigned." />
      )}
      {cur?.status === "PLANNING" && (
        <Waiting title="Your plan is being prepared" text={`${cur.coach?.name ?? "Your coach"} is reading your answers and building your plan. You'll get a notification when it's ready.`} />
      )}

      {cur?.status === "ACTIVE" && <Running cur={cur} onChanged={load} />}

      {cur?.status === "FINAL_ASSESSMENT" &&
        (questions.FINAL ? (
          <section aria-labelledby="qf-heading" className="flex flex-col gap-4">
            <h2 id="qf-heading" className="font-display text-xl font-semibold">You reached the last day</h2>
            <p className="text-sm text-[var(--w360-text-muted)] measure">
              Answer the same questions as at the start, so you and your coach can see what changed. Your coach then writes your final review.
            </p>
            <Questionnaire kind="FINAL" questions={questions.FINAL} initial={(cur.final?.answers as Answers) ?? {}} onSave={saveAnswers("FINAL")} />
          </section>
        ) : (
          <LoadingState variant="rows" />
        ))}

      {cur?.status === "FINAL_REVIEW" && <Waiting title="Your final answers are in" text={`${cur.coach?.name ?? "Your coach"} is writing your final review.`} />}

      {cur?.status === "COMPLETED" && (
        <>
          <Completed cur={cur} questions={questions.FINAL} />
          {data.available.length > 0 && <Join programmes={data.available} onJoined={load} another />}
        </>
      )}

      {cur && !["COMPLETED", "LEFT"].includes(cur.status) && <Leave hasCoach={!!cur.coach} onLeft={load} />}
    </div>
  );
}

function Waiting({ title, text }: { title: string; text: string }) {
  return (
    <section className="border-t border-[var(--w360-border)] pt-5">
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <p className="text-sm text-[var(--w360-text-muted)] mt-1 measure">{text}</p>
    </section>
  );
}

function Join({ programmes, onJoined, another }: { programmes: ProgrammeSummary[]; onJoined: () => void; another?: boolean }) {
  const [chosen, setChosen] = useState<ProgrammeSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (programmes.length === 0) {
    return <EmptyState title="No programme is open to join right now" description="When one opens, it will be listed here." />;
  }
  async function join() {
    if (!chosen) return;
    setBusy(true);
    setError("");
    try {
      await programmeService.join(chosen.id);
      setChosen(null);
      onJoined();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't join. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="join-heading" className="flex flex-col gap-3">
      <h2 id="join-heading" className="font-display text-xl font-semibold">{another ? "Join another programme" : "Programmes you can join"}</h2>
      <ul className="flex flex-col divide-y divide-[var(--w360-border)] border-y border-[var(--w360-border)]">
        {programmes.map((p) => (
          <li key={p.id} className="py-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <div className="min-w-0">
              <h3 className="font-medium">{p.name}</h3>
              <p className="text-sm text-[var(--w360-text-muted)] measure">{p.summary}</p>
              <p className="text-xs text-[var(--w360-text-muted)] mt-1 tabular-nums">{p.durationDays} days, with a coach</p>
            </div>
            <Button variant="secondary" onClick={() => setChosen(p)} className="shrink-0">
              Join<span className="sr-only"> {p.name}</span>
            </Button>
          </li>
        ))}
      </ul>
      <Modal open={chosen !== null} onClose={() => setChosen(null)} title={chosen ? `Join ${chosen.name}` : ""} size="sm">
        <div className="flex flex-col gap-4 text-sm">
          <p>To guide you, a coach needs to see two things, and only these two:</p>
          <ul className="list-disc pl-5 flex flex-col gap-1">
            <li>your answers to the starting and final questions, and</li>
            <li>what you report on your programme tasks (done, skipped, or a request for help).</li>
          </ul>
          <p className="text-[var(--w360-text-muted)]">
            Your other records (cycle, meals, sleep, medicines and the rest) stay private. You can leave at any time, and your coach then stops
            seeing your plan. This is guidance on habits, not medical care.
          </p>
          {error && <p role="alert" className="text-red-600 dark:text-red-400">{error}</p>}
          <Button onClick={join} disabled={busy}>{busy ? "Joining…" : "I agree. Join and start"}</Button>
        </div>
      </Modal>
    </section>
  );
}

function Running({ cur, onChanged }: { cur: NonNullable<MyProgramme["current"]>; onChanged: () => void }) {
  const [days, setDays] = useState(cur.days);
  useEffect(() => setDays(cur.days), [cur.days]);
  const [today, ...earlier] = days;
  const p = cur.progress;

  return (
    <>
      {cur.day !== null && (
        <ProgressBar value={(cur.day / cur.programme.durationDays) * 100} label={`Day ${cur.day} of ${cur.programme.durationDays}`} />
      )}

      <section aria-labelledby="today-heading" className="flex flex-col gap-3">
        <h2 id="today-heading" className="font-display text-xl font-semibold">Today</h2>
        <Hint id="programme-today" className="text-sm text-[var(--w360-text-muted)]">
          Tick a task when it's done. If one doesn't fit today, skip it, or ask your coach for help: missing a day is fine, and you can still report the two days before today.
        </Hint>
        {today && today.tasks.length > 0 ? (
          <ul className="flex flex-col divide-y divide-[var(--w360-border)] border-y border-[var(--w360-border)]">
            {today.tasks.map((t) => (
              <TaskRow key={t.id} task={t} date={today.date} isToday onUpdated={onChanged} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--w360-text-muted)]">Nothing is planned for today. Rest is part of the plan.</p>
        )}
      </section>

      {earlier.map((d) => (
        <section key={d.date} aria-labelledby={`d-${d.date}`} className="flex flex-col gap-3">
          <h2 id={`d-${d.date}`} className="font-display text-lg font-semibold">Still open from {longDate(d.date)}</h2>
          <ul className="flex flex-col divide-y divide-[var(--w360-border)] border-y border-[var(--w360-border)]">
            {d.tasks.map((t) => (
              <TaskRow key={t.id} task={t} date={d.date} isToday={false} onUpdated={onChanged} />
            ))}
          </ul>
        </section>
      ))}

      {p && p.due > 0 && (
        <section aria-labelledby="so-far" className="flex flex-col gap-1">
          <h2 id="so-far" className="font-display text-lg font-semibold">So far</h2>
          <p className="text-sm tabular-nums">
            {p.done} of {p.due} tasks done, on {p.activeDays} {p.activeDays === 1 ? "day" : "days"}.
          </p>
          <p className="text-xs text-[var(--w360-text-muted)]">This counts what you did with your plan. It isn't a measure of your health.</p>
        </section>
      )}

      {(cur.reviews.length > 0 || cur.nextReviewOn) && (
        <section aria-labelledby="reviews" className="flex flex-col gap-3">
          <h2 id="reviews" className="font-display text-lg font-semibold">From your coach</h2>
          {cur.nextReviewOn && <p className="text-sm">Next review: {longDate(cur.nextReviewOn)}</p>}
          {cur.reviews.map((r) => (
            <blockquote key={r.at} className="border-l-2 border-maroon-600 dark:border-maroon-300 pl-3 text-sm">
              <p className="whitespace-pre-line">{r.notes}</p>
              <footer className="text-xs text-[var(--w360-text-muted)] mt-1">{longDate(r.at)}</footer>
            </blockquote>
          ))}
        </section>
      )}

      {cur.changes.length > 1 && (
        <section aria-labelledby="changes" className="flex flex-col gap-2">
          <h2 id="changes" className="font-display text-lg font-semibold">Changes to your plan</h2>
          <ul className="flex flex-col gap-1.5 text-sm">
            {cur.changes.filter((c) => c.version > 1).map((c) => (
              <li key={c.version}>
                <span className="text-[var(--w360-text-muted)] tabular-nums">{longDate(c.at)}: </span>
                {c.reason}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function Completed({ cur, questions }: { cur: NonNullable<MyProgramme["current"]>; questions: Question[] | null }) {
  const final = cur.reviews.find((r) => r.kind === "FINAL");
  return (
    <section aria-labelledby="done-heading" className="flex flex-col gap-5">
      <div>
        <h2 id="done-heading" className="font-display text-2xl font-semibold">You completed {cur.programme.name}</h2>
        {cur.progress && cur.progress.due > 0 && (
          <p className="text-sm mt-1 tabular-nums">
            {cur.progress.done} of {cur.progress.due} tasks done, on {cur.progress.activeDays} days.
          </p>
        )}
      </div>
      {final && (
        <blockquote className="border-l-2 border-maroon-600 dark:border-maroon-300 pl-3 text-sm">
          <p className="whitespace-pre-line">{final.notes}</p>
          <footer className="text-xs text-[var(--w360-text-muted)] mt-1">{cur.coach ? `${cur.coach.name}, your coach` : "Your coach"}</footer>
        </blockquote>
      )}
      {cur.comparison && questions && (
        <div className="relative overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="text-left font-display text-lg font-semibold mb-2">Then and now, in your own words</caption>
            <thead>
              <tr className="text-left text-[var(--w360-text-muted)]">
                <th scope="col" className="py-2 pr-3 font-medium">Question</th>
                <th scope="col" className="py-2 pr-3 font-medium">At the start</th>
                <th scope="col" className="py-2 font-medium">At the end</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--w360-border)]">
              {cur.comparison.map((c) => {
                const q = questions.find((x) => x.id === c.id);
                return (
                  <tr key={c.id}>
                    <th scope="row" className="py-2 pr-3 font-normal text-left">{q?.label ?? c.id}</th>
                    <td className="py-2 pr-3 tabular-nums">{answerText(q, c.before)}</td>
                    <td className="py-2 tabular-nums">{answerText(q, c.after)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-xs text-[var(--w360-text-muted)] mt-2">These are your own answers, not a medical result.</p>
        </div>
      )}
    </section>
  );
}

function Leave({ hasCoach, onLeft }: { hasCoach: boolean; onLeft: () => void }) {
  const [open, setOpen] = useState(false);
  const toast = useToast();
  return (
    <div className="border-t border-[var(--w360-border)] pt-4">
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>Leave this programme</Button>
      <ConfirmDialog
        open={open}
        title="Leave this programme?"
        description={`Your plan stops${hasCoach ? " and your coach no longer sees it" : ""}. What you reported is kept in your records (and in your data download). You can join a programme again later.`}
        confirmLabel="Leave"
        onCancel={() => setOpen(false)}
        onConfirm={async () => {
          setOpen(false);
          try {
            await programmeService.leave();
            toast.show("You left the programme");
            onLeft();
          } catch (err) {
            toast.show(err instanceof Error ? err.message : "Couldn't leave. Please try again.", { tone: "error" });
          }
        }}
      />
    </div>
  );
}
