import { useCallback, useEffect, useState } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { adminService } from "@/services/adminService";
import type { UsageSummary } from "@/types";

const RANGES = [7, 30, 90] as const;

// What each counted name means, in plain words.
const SCREEN_LABEL: Record<string, string> = {
  dashboard: "Today", cycle: "Cycle", nutrition: "Nutrition", activity: "Activity", sleep: "Sleep", wellbeing: "Wellbeing",
  habits: "Habits", goals: "Goals", health: "Health", insights: "Insights", reports: "Reports", messages: "Messages",
  settings: "Settings", learn: "Learn",
};
const ACTION_LABEL: Record<string, string> = {
  sleep_logged: "Sleep logged", meal_logged: "Meal logged", water_logged: "Water logged", activity_logged: "Activity logged",
  cycle_logged: "Cycle day logged", mood_logged: "Mood logged", goal_created: "Goal created", habit_created: "Habit created",
  habit_ticked: "Habit ticked", medication_added: "Medicine added", appointment_added: "Appointment added",
  dose_recorded: "Dose recorded", report_generated: "Report made", reminders_on: "Closed-app reminders turned on",
};

function CountList({ title, rows, label }: { title: string; rows: { name: string; count: number }[]; label: Record<string, string> }) {
  return (
    <Card>
      <CardBody className="pt-5">
        <h2 className="font-medium">{title}</h2>
        {rows.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--w360-text-muted)]">Nothing yet in this period.</p>
        ) : (
          <table className="mt-2 w-full text-sm">
            <caption className="sr-only">{title}</caption>
            <thead className="sr-only">
              <tr><th scope="col">Name</th><th scope="col">Times</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name} className="border-t border-[var(--w360-border)] first:border-0">
                  <th scope="row" className="py-1.5 pr-3 text-left font-normal">{label[r.name] ?? r.name}</th>
                  <td className="py-1.5 text-right tabular-nums">{r.count.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardBody>
    </Card>
  );
}

/** What is used, never who: anonymous daily counts of screens opened and actions done. */
export function UsageTab() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const [data, setData] = useState<UsageSummary | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const load = useCallback(() => {
    setFailed(null);
    setData(null);
    adminService.usage(days).then(setData).catch((err) => setFailed(err instanceof Error ? err.message : "Couldn't load usage."));
  }, [days]);
  useEffect(load, [load]);

  if (failed) return <ErrorState title="Couldn't load usage" description={failed} onRetry={load} />;
  if (!data) return <LoadingState />;

  const busiest = Math.max(1, ...data.daily.map((d) => d.active));
  const totalSignups = data.daily.reduce((n, d) => n + d.signups, 0);
  const today = data.daily[data.daily.length - 1];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--w360-text-muted)] max-w-xl">
          Anonymous counts only: how often each screen is opened and each action is done, and how many different women used the app each day. Nothing here says who, and staff and demonstration accounts aren't counted.
        </p>
        <div role="group" aria-label="Period" className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={days === r}
              onClick={() => setDays(r)}
              className={`px-3 py-1.5 rounded-md text-sm border border-[var(--w360-border)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--w360-focus)] ${days === r ? "bg-maroon-700 text-white border-maroon-700" : ""}`}
            >
              {r} days
            </button>
          ))}
        </div>
      </div>

      <section aria-label="Totals" className="grid grid-cols-2 gap-4">
        <Card><CardBody className="pt-5">
          <p className="text-sm text-[var(--w360-text-muted)]">Active today (so far)</p>
          <p className="font-display text-3xl font-semibold tabular-nums mt-1">{today?.active ?? 0}</p>
        </CardBody></Card>
        <Card><CardBody className="pt-5">
          <p className="text-sm text-[var(--w360-text-muted)]">New accounts, last {days} days</p>
          <p className="font-display text-3xl font-semibold tabular-nums mt-1">{totalSignups}</p>
        </CardBody></Card>
      </section>

      <Card>
        <CardBody className="pt-5">
          <h2 className="font-medium">Different women active each day</h2>
          <p className="text-xs text-[var(--w360-text-muted)] mt-1">Days are counted in UTC, so they can differ from your local day by a few hours.</p>
          <div className="mt-3 max-h-80 overflow-y-auto" tabIndex={0} role="region" aria-label="Daily activity, scrollable">
            <table className="w-full text-sm">
              <caption className="sr-only">Different women active, and new accounts, for each day</caption>
              <thead className="text-left text-[var(--w360-text-muted)]">
                <tr><th scope="col" className="py-1 font-normal">Day</th><th scope="col" className="py-1 font-normal">Active</th><th scope="col" className="py-1 text-right font-normal">New accounts</th></tr>
              </thead>
              <tbody>
                {[...data.daily].reverse().map((d) => (
                  <tr key={d.day} className="border-t border-[var(--w360-border)]">
                    <th scope="row" className="py-1.5 text-left font-normal tabular-nums">{d.day}</th>
                    <td className="py-1.5 w-1/2">
                      <div className="flex items-center gap-2">
                        <span className="tabular-nums w-8">{d.active}</span>
                        <span aria-hidden className="h-2 rounded-sm bg-maroon-700/70" style={{ width: `${(d.active / busiest) * 100}%`, minWidth: d.active ? 2 : 0 }} />
                      </div>
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{d.signups}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <CountList title={`Screens opened, last ${days} days`} rows={data.screens} label={SCREEN_LABEL} />
        <CountList title={`Actions done, last ${days} days`} rows={data.actions} label={ACTION_LABEL} />
      </div>
    </div>
  );
}
