import { useEffect, useState } from "react";
import clsx from "clsx";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { DurationField } from "@/components/ui/DurationField";
import { LoadingState } from "@/components/ui/states";
import { useToast } from "@/components/ui/Toast";
import { planService } from "@/services/planService";
import { localDateISO } from "@/services/mappers";
import { FEASIBILITY_LABEL, FEASIBILITY_TONE, WEEKDAYS, toggleDay } from "@/lib/activityPlan";
import { PlanWeeks } from "./PlanWeeks";
import type { ActivePlan, ActivityPlan, PlanOptions, PlanRequest } from "@/types";

const choice = (selected: boolean) =>
  clsx(
    "rounded-xl border px-3.5 py-2.5 text-left text-sm senior:text-lg transition-colors",
    selected ? "border-maroon-700 bg-[var(--w360-tint)] dark:border-maroon-300" : "border-[var(--w360-border)] hover:border-maroon-400"
  );

/**
 * Two steps: answer a few pre-filled questions (usually just the goal), then read the
 * plan and its honest feasibility before deciding to start it. Nothing is saved until
 * she chooses "Start this plan".
 */
export function PlanWizard({ open, onClose, onStarted }: { open: boolean; onClose: () => void; onStarted: (plan: ActivePlan) => void }) {
  const toast = useToast();
  const [options, setOptions] = useState<PlanOptions | null>(null);
  const [form, setForm] = useState<Omit<PlanRequest, "startDate"> | null>(null);
  const [plan, setPlan] = useState<ActivityPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPlan(null);
    setFailed(false);
    planService
      .options()
      .then((o) => {
        setOptions(o);
        setForm({ goal: o.defaults.goal, weeks: o.defaults.weeks, days: o.defaults.days, sessionMinutes: o.defaults.sessionMinutes, activityCodes: o.defaults.activityCodes });
      })
      .catch((err) => {
        setFailed(true);
        toast.show(err instanceof Error ? err.message : "Couldn't load the plan options.", { tone: "error" });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Moving between the questions and the result starts at the top of the dialog, not wherever it was scrolled.
  useEffect(() => {
    document.querySelector('[role="dialog"]')?.scrollTo({ top: 0 });
  }, [plan]);

  const request = (): PlanRequest => ({ ...form!, startDate: localDateISO() });
  const valid = form !== null && form.days.length > 0 && form.sessionMinutes >= 10;

  async function show() {
    setBusy(true);
    try {
      setPlan(await planService.preview(request()));
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't build that plan. Please try again.", { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function startIt() {
    setBusy(true);
    try {
      onStarted(await planService.start(request()));
      onClose();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't start the plan. Please try again.", { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={plan ? "Your plan" : "Plan for a goal"} size="lg">
      {failed ? (
        <p className="text-sm text-[var(--w360-text-muted)]">We couldn't load this just now. Close it and try again.</p>
      ) : !options || !form ? (
        <LoadingState label="Looking at your activity" />
      ) : plan ? (
        <ResultStep plan={plan} busy={busy} onBack={() => setPlan(null)} onStart={startIt} />
      ) : (
        <div className="flex flex-col gap-6">
          <p className="text-sm senior:text-base text-[var(--w360-text-muted)]">
            {options.baseline.hasHistory
              ? `Filled in from your own logs: you've been doing about ${options.baseline.aerobicMinutesPerWeek} minutes of moderate activity a week. Change only what's different.`
              : "You haven't logged recent activity, so the plan starts gently. Change anything that isn't right."}
          </p>

          <fieldset>
            <legend className="text-sm font-medium mb-2 senior:text-lg">What is it for?</legend>
            <div className="flex flex-col gap-2" role="radiogroup">
              {options.goals.map((g) => (
                <button key={g.code} type="button" role="radio" aria-checked={form.goal === g.code} onClick={() => setForm({ ...form, goal: g.code })} className={choice(form.goal === g.code)}>
                  <span className="font-medium block">{g.label}</span>
                  <span className="text-[var(--w360-text-muted)] text-xs senior:text-base">{g.description}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium mb-2 senior:text-lg">Which days can you be active?</legend>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((d) => {
                const on = form.days.includes(d.iso);
                return (
                  <button
                    key={d.iso}
                    type="button"
                    aria-pressed={on}
                    aria-label={d.long}
                    onClick={() => setForm({ ...form, days: toggleDay(form.days, d.iso) })}
                    className={clsx(choice(on), "min-w-[3.25rem] text-center px-3")}
                  >
                    {d.short}
                  </button>
                );
              })}
            </div>
            {form.days.length === 0 && <p className="text-xs text-red-600 dark:text-red-400 mt-1.5">Choose at least one day.</p>}
          </fieldset>

          <DurationField
            label="Time you have on each of those days"
            value={form.sessionMinutes}
            max={180}
            startAtMinutes={30}
            onChange={(m) => setForm({ ...form, sessionMinutes: m ?? 0 })}
            error={form.sessionMinutes < 10 ? "At least 10 minutes." : undefined}
            hint="Strength and balance sessions fit inside this time, with walking or other activity filling the rest."
          />

          <fieldset>
            <legend className="text-sm font-medium mb-2 senior:text-lg">How long?</legend>
            <div className="flex gap-2" role="radiogroup">
              {options.weeksChoices.map((w) => (
                <button key={w} type="button" role="radio" aria-checked={form.weeks === w} onClick={() => setForm({ ...form, weeks: w })} className={clsx(choice(form.weeks === w), "text-center flex-1")}>
                  {w} weeks
                </button>
              ))}
            </div>
          </fieldset>

          <details className="group">
            <summary className="cursor-pointer text-sm font-medium senior:text-lg">Activities you'd like (optional)</summary>
            <p className="text-xs text-[var(--w360-text-muted)] mt-1.5 mb-2 senior:text-base">Pick up to three. Left as it is, the plan uses what you already do, or walking.</p>
            <div className="flex flex-wrap gap-2">
              {options.aerobicActivities
                .filter((a) => a.available)
                .map((a) => {
                  const on = form.activityCodes.includes(a.code);
                  return (
                    <button
                      key={a.code}
                      type="button"
                      aria-pressed={on}
                      disabled={!on && form.activityCodes.length >= 3}
                      onClick={() => setForm({ ...form, activityCodes: on ? form.activityCodes.filter((c) => c !== a.code) : [...form.activityCodes, a.code] })}
                      className={clsx(choice(on), "py-1.5 disabled:opacity-40")}
                    >
                      {a.label}
                    </button>
                  );
                })}
            </div>
          </details>

          <Button size="lg" fullWidth disabled={!valid || busy} onClick={show}>
            {busy ? "Building your plan…" : "Show my plan"}
          </Button>
        </div>
      )}
    </Modal>
  );
}

function ResultStep({ plan, busy, onBack, onStart }: { plan: ActivityPlan; busy: boolean; onBack: () => void; onStart: () => void }) {
  const f = plan.feasibility;
  return (
    <div className="flex flex-col gap-5">
      <section aria-label="How realistic this is" className="rounded-xl border border-[var(--w360-border)] p-4 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={FEASIBILITY_TONE[f.level]}>{FEASIBILITY_LABEL[f.level]}</Badge>
          <h3 className="font-display text-lg senior:text-2xl font-semibold">{f.headline}</h3>
        </div>
        <ul className="list-disc pl-5 text-sm senior:text-base text-[var(--w360-text)] flex flex-col gap-1">
          {f.reasons.map((r) => <li key={r}>{r}</li>)}
        </ul>
        {f.suggestions.length > 0 && (
          <ul className="list-disc pl-5 text-sm senior:text-base text-[var(--w360-text-muted)] flex flex-col gap-1">
            {f.suggestions.map((s) => <li key={s}>{s}</li>)}
          </ul>
        )}
        <p className="text-xs senior:text-base text-[var(--w360-text-muted)]">
          Aerobic activity builds from {plan.startAerobic} to {plan.peakAerobic} moderate-equivalent minutes a week. The WHO suggests at least 150 for adults. Hard effort, such as running, counts double.
        </p>
      </section>

      <section aria-label="Before you start" className="rounded-xl bg-[var(--w360-bg-warm)] p-4 flex flex-col gap-2">
        <h3 className="text-sm senior:text-lg font-semibold">Before you start</h3>
        <ul className="list-disc pl-5 text-sm senior:text-base flex flex-col gap-1.5">
          {plan.cautions.map((c) => <li key={c}>{c}</li>)}
        </ul>
      </section>

      <PlanWeeks weeks={plan.weeksPlan} openWeek={1} />

      <p className="text-xs senior:text-base text-[var(--w360-text-muted)]">
        Based on <a href={plan.source.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">{plan.source.label}</a>. How fast it builds is our own cautious choice, not the WHO's. {plan.review.note}
      </p>

      <div className="flex flex-col sm:flex-row gap-2">
        <Button size="lg" fullWidth disabled={busy} onClick={onStart}>{busy ? "Starting…" : "Start this plan"}</Button>
        <Button size="lg" variant="secondary" fullWidth disabled={busy} onClick={onBack}>Change my answers</Button>
      </div>
    </div>
  );
}
