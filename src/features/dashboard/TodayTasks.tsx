import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CalendarClock } from "lucide-react";
import SpringCheck from "@/components/reactbits/SpringCheck";
import { Card, CardBody } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { goalService } from "@/services/goalService";
import { healthService } from "@/services/healthService";
import { localDateISO } from "@/services/mappers";
import type { Appointment, Goal, MedicationDose, WellbeingEntry } from "@/types";

interface Task {
  id: string;
  label: string;
  detail?: string;
  done: boolean;
  /** A done task that can't be reversed here (e.g. a dose already logged as taken). */
  locked?: boolean;
  toggle: (next: boolean) => Promise<void> | void;
}

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/**
 * Everything the person still has to do today, drawn only from things they've
 * actually set up: medicine doses, goals they check in on, today's
 * appointments, and the mood check-in. Ticking one does the real thing (logs
 * the dose, records the check-in); a task that needs a form (mood) opens that
 * form and ticks itself once the entry exists. Nothing here is invented.
 */
export function TodayTasks({
  goals,
  onGoalChange,
  todayMood,
  appointments,
}: {
  goals: Goal[];
  onGoalChange: (goal: Goal) => void;
  todayMood: WellbeingEntry | null;
  appointments: Appointment[];
}) {
  const nav = useNavigate();
  const toast = useToast();
  const [doses, setDoses] = useState<MedicationDose[] | null>(null);
  // What the person just ticked, shown immediately while the request is in
  // flight; dropped again if it fails.
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});

  useEffect(() => {
    healthService.getTodayMedications().then(setDoses).catch(() => setDoses([]));
  }, []);

  const todayISO = localDateISO();
  const todaysAppointments = appointments.filter((a) => a.date.slice(0, 10) === todayISO);

  async function run(id: string, next: boolean, action: () => Promise<void>, failure: string) {
    setOptimistic((o) => ({ ...o, [id]: next }));
    try {
      await action();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : failure, { tone: "error" });
    } finally {
      setOptimistic((o) => {
        const rest = { ...o };
        delete rest[id];
        return rest;
      });
    }
  }

  const tasks = useMemo<Task[]>(() => {
    const list: Task[] = [];

    for (const dose of doses ?? []) {
      if (dose.status === "SKIPPED") continue;
      const id = `dose:${dose.medicationId}:${dose.scheduledFor}`;
      list.push({
        id,
        label: `${dose.medicationName}${dose.dose ? ` ${dose.dose}` : ""}`,
        detail: dose.status === "OVERDUE" ? `Was due ${timeOf(dose.scheduledFor)}` : timeOf(dose.scheduledFor),
        done: dose.status === "TAKEN",
        locked: dose.status === "TAKEN",
        toggle: (next) =>
          next
            ? run(id, true, async () => {
                await healthService.logMedicationDose(dose.medicationId, dose.scheduledFor, "TAKEN");
                setDoses((d) =>
                  d ? d.map((x) => (x.medicationId === dose.medicationId && x.scheduledFor === dose.scheduledFor ? { ...x, status: "TAKEN" } : x)) : d
                );
              }, "Couldn't log that dose. Please try again.")
            : undefined,
      });
    }

    for (const goal of goals.filter((g) => !g.completed)) {
      const id = `goal:${goal.id}`;
      list.push({
        id,
        label: goal.title,
        detail: goal.reminder,
        done: goal.checkedInToday,
        toggle: (next) =>
          run(id, next, async () => {
            onGoalChange(await (next ? goalService.checkIn(goal.id) : goalService.undoCheckIn(goal.id)));
          }, "Couldn't save your check-in. Please try again."),
      });
    }

    list.push({
      id: "mood",
      label: "Check in on how you feel",
      done: todayMood !== null,
      locked: todayMood !== null,
      toggle: () => nav("/app/wellbeing"),
    });

    // Open first, then done; the order inside each group is the order above.
    return [...list.filter((t) => !(optimistic[t.id] ?? t.done)), ...list.filter((t) => optimistic[t.id] ?? t.done)];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doses, goals, todayMood, optimistic]);

  const open = tasks.filter((t) => !(optimistic[t.id] ?? t.done)).length;
  const loading = doses === null;

  return (
    <Card>
      <CardBody className="p-0">
        <div className="px-5 pt-4 pb-1 flex items-baseline justify-between gap-3">
          <p className="text-sm text-[var(--w360-text-muted)]" aria-live="polite">
            {loading ? "Loading today's list" : open === 0 ? "All done for today" : `${open} left today`}
          </p>
        </div>
        <ul className="px-5 pb-3 divide-y divide-[var(--w360-border)]">
          {tasks.map((t) => {
            const checked = optimistic[t.id] ?? t.done;
            return (
              <li key={t.id} className="flex items-center justify-between gap-3">
                <SpringCheck
                  label={t.label}
                  checked={checked}
                  disabled={t.locked}
                  onChange={(next: boolean) => t.toggle(next)}
                  color="var(--w360-text)"
                  fillColor="var(--w360-accent)"
                  checkColor="var(--w360-bg-raised)"
                  boxSize={26}
                  boxRadius={13}
                  fontSize={16}
                  doneOpacity={0.5}
                />
                {t.detail && <span className="text-xs text-[var(--w360-text-muted)] shrink-0 tabular-nums">{t.detail}</span>}
              </li>
            );
          })}
          {todaysAppointments.map((a) => (
            <li key={a.id}>
              <Link to="/app/health?tab=appointments" className="flex items-center gap-3 py-3 text-base">
                <CalendarClock size={22} strokeWidth={1.75} className="text-[var(--w360-text-muted)] shrink-0" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{a.title}</span>
                <span className="text-xs text-[var(--w360-text-muted)] shrink-0 tabular-nums">{a.time}</span>
              </Link>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
