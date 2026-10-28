import { useState } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { activityService } from "@/services/activityService";
import { planService } from "@/services/planService";
import { localDateISO } from "@/services/mappers";
import { FEASIBILITY_LABEL, FEASIBILITY_TONE, dayLabel } from "@/lib/activityPlan";
import { PlanWeeks, SessionLine } from "./PlanWeeks";
import type { ActivePlan, Effort } from "@/types";
import { Hint } from "@/components/ui/Hint";

/** Where she is in the plan she started: this week's sessions, one tap to log one, and how the week is going. */
export function ActivePlanCard({ active, onChanged, onEnded }: { active: ActivePlan; onChanged: () => void; onEnded: () => void }) {
  const toast = useToast();
  const [ending, setEnding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const { plan, progress } = active;
  const today = localDateISO();
  const week = plan.weeksPlan[progress.currentWeek - 1];
  const doneAerobic = progress.weekDone.aerobicEquivalent;
  const plannedAerobic = week.aerobicEquivalent;
  const pct = plannedAerobic > 0 ? Math.round((doneAerobic / plannedAerobic) * 100) : 0;

  async function logSession(index: number) {
    const s = week.sessions[index];
    setBusy(`${s.date}-${s.kind}`);
    try {
      await activityService.logActivity({ activityCode: s.activityCode, duration: s.minutes, intensity: s.intensity.toLowerCase() as Effort, day: s.date });
      onChanged();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't log that. Please try again.", { tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  async function end() {
    try {
      await planService.end(active.id);
      setEnding(false);
      onEnded();
      toast.show("Plan ended. Your logged activity is kept.");
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't end the plan. Please try again.", { tone: "error" });
    }
  }

  const header =
    progress.state === "UPCOMING"
      ? `Starts ${dayLabel(plan.startDate)}`
      : progress.state === "FINISHED"
        ? "Plan finished"
        : `Week ${progress.currentWeek} of ${plan.weeks} · ${week.focus}`;

  return (
    <section aria-label="Your activity plan">
      <Card>
        <CardBody className="pt-5 flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="font-display text-lg senior:text-2xl font-semibold">{plan.goalLabel}</h2>
              <p className="text-sm senior:text-base text-[var(--w360-text-muted)]">{header}</p>
            </div>
            <Badge tone={FEASIBILITY_TONE[plan.feasibility.level]}>{FEASIBILITY_LABEL[plan.feasibility.level]}</Badge>
          </div>

          {progress.state === "FINISHED" ? (
            <p className="text-sm senior:text-lg">
              The {plan.weeks} weeks are done. You can end this plan and build a new one from what you've logged since.
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-sm senior:text-lg">
                  <span>Aerobic this week</span>
                  <span className="tabular-nums">{doneAerobic} of {plannedAerobic} min</span>
                </div>
                <ProgressBar value={pct} label="Aerobic minutes this week" />
                {(week.strengthSessions > 0 || week.mobilitySessions > 0) && (
                  <p className="text-xs senior:text-base text-[var(--w360-text-muted)]">
                    {week.strengthSessions > 0 && `Strength ${progress.weekDone.strengthSessions} of ${week.strengthSessions}. `}
                    {week.mobilitySessions > 0 && `Balance and mobility ${progress.weekDone.mobilitySessions} of ${week.mobilitySessions}.`}
                  </p>
                )}
                <Hint id="plan-counts" className="text-xs senior:text-base text-[var(--w360-text-muted)]">
                  Anything you log this week counts, not only the suggested activity.
                </Hint>
              </div>

              <ul className="divide-y divide-[var(--w360-border)]" aria-label="This week's sessions">
                {week.sessions.map((s, i) => (
                  <SessionLine
                    key={`${s.date}-${s.kind}-${s.activityCode}`}
                    session={s}
                    today={today}
                    trailing={
                      !s.done && s.date <= today ? (
                        <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => logSession(i)}>
                          {busy === `${s.date}-${s.kind}` ? "Logging…" : "Log it"}
                        </Button>
                      ) : undefined
                    }
                  />
                ))}
              </ul>
            </>
          )}

          <details>
            <summary className="cursor-pointer text-sm senior:text-lg font-medium">The whole plan and safety notes</summary>
            <div className="flex flex-col gap-4 mt-3">
              <PlanWeeks weeks={plan.weeksPlan} openWeek={progress.currentWeek} today={today} />
              <ul className="list-disc pl-5 text-xs senior:text-base text-[var(--w360-text-muted)] flex flex-col gap-1">
                {plan.cautions.map((c) => <li key={c}>{c}</li>)}
              </ul>
              <p className="text-xs senior:text-base text-[var(--w360-text-muted)]">{plan.review.note}</p>
            </div>
          </details>

          <div>
            <Button variant="ghost" size="sm" onClick={() => setEnding(true)}>End this plan</Button>
          </div>
        </CardBody>
      </Card>
      <ConfirmDialog
        open={ending}
        title="End this plan?"
        description="Your logged activity stays. You can build a new plan any time."
        confirmLabel="End plan"
        destructive={false}
        onConfirm={end}
        onCancel={() => setEnding(false)}
      />
    </section>
  );
}
