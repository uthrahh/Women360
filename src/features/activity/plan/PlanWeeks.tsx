import { Check } from "lucide-react";
import clsx from "clsx";
import { dayLabel } from "@/lib/activityPlan";
import type { PlanSession, PlanWeek } from "@/types";

const KIND_LABEL: Record<PlanSession["kind"], string> = { AEROBIC: "Aerobic", STRENGTH: "Strength", MOBILITY: "Balance and mobility" };

/** One planned session as a line: the day, what, how long, how hard, and how it should feel. */
export function SessionLine({ session, today, trailing }: { session: PlanSession; today?: string; trailing?: React.ReactNode }) {
  const isToday = today === session.date;
  return (
    <li className="py-2.5 flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
      <div className="min-w-0">
        <p className="text-sm senior:text-lg">
          <span className={clsx("font-medium", session.done && "line-through opacity-60")}>
            {session.label}, {session.minutes} min
          </span>
          {session.done && <Check size={14} className="inline ml-1.5 -mt-0.5 text-emerald-700 dark:text-emerald-300" aria-label="Done" />}
          {isToday && <span className="ml-2 text-xs font-medium text-maroon-700 dark:text-maroon-200">Today</span>}
        </p>
        <p className="text-xs senior:text-base text-[var(--w360-text-muted)]">
          {dayLabel(session.date)} · {KIND_LABEL[session.kind]} · {session.effort}. {session.feel}
          {session.caloriesEstimate !== null && ` About ${session.caloriesEstimate} kcal.`}
        </p>
        {session.note && <p className="text-xs senior:text-base text-[var(--w360-text-muted)]">{session.note}</p>}
      </div>
      {trailing}
    </li>
  );
}

/** Every week of a plan, collapsed except the one asked for. */
export function PlanWeeks({ weeks, openWeek, today }: { weeks: PlanWeek[]; openWeek: number; today?: string }) {
  return (
    <section aria-label="Week by week" className="flex flex-col divide-y divide-[var(--w360-border)] rounded-xl border border-[var(--w360-border)]">
      {weeks.map((w) => (
        <details key={w.week} open={w.week === openWeek} className="px-4">
          <summary className="cursor-pointer py-3 flex flex-wrap items-baseline justify-between gap-x-3 text-sm senior:text-lg">
            <span className="font-medium">Week {w.week} · {w.focus}</span>
            <span className="text-xs senior:text-base text-[var(--w360-text-muted)]">
              {w.aerobicMinutes} min aerobic{w.aerobicEquivalent !== w.aerobicMinutes && ` (counts as ${w.aerobicEquivalent})`}
              {w.strengthSessions > 0 && ` · ${w.strengthSessions} strength`}
              {w.mobilitySessions > 0 && ` · ${w.mobilitySessions} balance`}
            </span>
          </summary>
          <ul className="divide-y divide-[var(--w360-border)] pb-2">
            {w.sessions.map((s) => (
              <SessionLine key={`${s.date}-${s.kind}-${s.activityCode}`} session={s} today={today} />
            ))}
          </ul>
        </details>
      ))}
    </section>
  );
}
