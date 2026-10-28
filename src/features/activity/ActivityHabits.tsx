import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import SpringCheck from "@/components/reactbits/SpringCheck";
import { Card, CardBody } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { NotificationPrompt } from "@/components/NotificationPrompt";
import { habitService } from "@/services/habitService";
import { isDueToday } from "@/lib/reminders";
import type { Habit } from "@/types";

/**
 * Today's to-do for the habits that are physical activities: what is still to do,
 * with its reminder time, and a tick that does the real thing (logs the habit).
 * Done ones sink to the bottom, like the dashboard's list.
 */
export function ActivityHabits({ habits, onChange }: { habits: Habit[]; onChange: (habit: Habit) => void }) {
  const toast = useToast();
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});

  // A habit with a weekly quota that is already met isn't shown as to-do, unless it was ticked today.
  const rows = useMemo(
    () => habits.filter((h) => h.activityCode && (h.doneToday || isDueToday(h))),
    [habits]
  );
  const isDone = (h: Habit) => optimistic[h.id] ?? h.doneToday;
  const ordered = [...rows.filter((h) => !isDone(h)), ...rows.filter(isDone)];
  const open = rows.filter((h) => !isDone(h)).length;

  async function toggle(habit: Habit, next: boolean) {
    setOptimistic((o) => ({ ...o, [habit.id]: next }));
    try {
      onChange(await (next ? habitService.log(habit.id) : habitService.unlog(habit.id)));
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't save that. Please try again.", { tone: "error" });
    } finally {
      setOptimistic((o) => {
        const rest = { ...o };
        delete rest[habit.id];
        return rest;
      });
    }
  }

  if (rows.length === 0) {
    return (
      <p className="text-xs text-[var(--w360-text-muted)]">
        Habits you mark as physical activities appear here as today's to-do. <Link to="/app/habits" className="underline underline-offset-2">Set up a habit</Link>
      </p>
    );
  }

  return (
    <section aria-label="Today's activity habits" className="flex flex-col gap-3">
      <Card>
        <CardBody className="p-0">
          <div className="px-5 pt-4 pb-1 flex items-baseline justify-between gap-3">
            <h2 className="font-display text-lg font-semibold">To do today</h2>
            <p className="text-sm text-[var(--w360-text-muted)]" aria-live="polite">{open === 0 ? "All done for today" : `${open} left`}</p>
          </div>
          <ul className="px-5 pb-3 divide-y divide-[var(--w360-border)]">
            {ordered.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-x-3">
                <SpringCheck
                  label={h.title}
                  checked={isDone(h)}
                  onChange={(next: boolean) => toggle(h, next)}
                  color="var(--w360-text)"
                  fillColor="var(--w360-accent)"
                  checkColor="var(--w360-bg-raised)"
                  boxSize={26}
                  boxRadius={13}
                  fontSize={16}
                  doneOpacity={0.5}
                />
                <span className="text-xs text-[var(--w360-text-muted)] tabular-nums w-full sm:w-auto pl-[38px] sm:pl-0 pb-2 sm:pb-0 sm:text-right">
                  {[h.target ? `${h.target.toLocaleString()}${h.unit ? ` ${h.unit}` : ""}` : null, h.reminder ? `Reminder ${h.reminder}` : null].filter(Boolean).join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
      {rows.some((h) => h.reminder) && <NotificationPrompt />}
    </section>
  );
}
