/**
 * Which programme tasks are due on which day, and where she stands with each. Pure: no database, so it is unit-tested.
 *
 * Due days are worked out from the task's schedule each time they are needed rather than stored as generated rows, so
 * a retried request can never create a duplicate occurrence. History is kept by never moving a published task's days:
 * pausing, stopping or replacing a task records the last day it was due (`endedOnDay`), and a replacement is a new task
 * that starts on the day of the change. Her calendar date is always sent by her own device.
 */

export type Frequency = "DAILY" | "WEEKDAYS" | "ONCE";
export type TaskStatus = "ACTIVE" | "PAUSED" | "STOPPED" | "REPLACED";
export type EventType = "DONE" | "SKIPPED" | "NEED_HELP" | "UNDONE" | "COACH_REPLY";

export interface Schedulable {
  frequency: Frequency;
  weekdays: number[];
  startDay: number;
  endDay: number;
  status: TaskStatus;
  published: boolean;
  endedOnDay: number | null;
}

const DAY_MS = 86_400_000;
const toUtc = (iso: string) => Date.parse(iso + "T00:00:00Z");

/** Day 1 is the start date itself. */
export function dayNumber(startIso: string, dateIso: string): number {
  return Math.round((toUtc(dateIso) - toUtc(startIso)) / DAY_MS) + 1;
}

/** The calendar date of a programme day. */
export function dateOfDay(startIso: string, day: number): string {
  return new Date(toUtc(startIso) + (day - 1) * DAY_MS).toISOString().slice(0, 10);
}

/** 0 = Sunday .. 6 = Saturday, for a calendar date (no time zone: it is her date). */
export const weekdayOf = (iso: string) => new Date(toUtc(iso)).getUTCDay();

export function isDue(task: Schedulable, day: number, weekday: number): boolean {
  if (!task.published) return false;
  if (day < task.startDay || day > task.endDay) return false;
  if (task.endedOnDay !== null && day > task.endedOnDay) return false;
  // Paused or stopped before it was ever due: nothing to keep.
  if (task.status !== "ACTIVE" && task.endedOnDay === null) return false;
  if (task.frequency === "ONCE") return day === task.startDay;
  if (task.frequency === "WEEKDAYS") return task.weekdays.includes(weekday);
  return true;
}

export interface TaskEventLike {
  type: EventType;
  value: number | null;
  note: string | null;
  createdAt: Date;
}

export interface DayState {
  status: "open" | "done" | "skipped" | "help";
  value: number | null;
  note: string | null;
  /** She asked for help and her coach has not answered since. */
  helpOpen: boolean;
  replies: { note: string; at: string }[];
}

/** Reads one task's events for one day, oldest first. The latest of her own events decides the status; replies accumulate. */
export function stateOf(events: TaskEventLike[]): DayState {
  const s: DayState = { status: "open", value: null, note: null, helpOpen: false, replies: [] };
  const sorted = [...events].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  for (const e of sorted) {
    switch (e.type) {
      case "DONE":
        Object.assign(s, { status: "done", value: e.value, note: e.note });
        break;
      case "SKIPPED":
        Object.assign(s, { status: "skipped", value: null, note: e.note });
        break;
      case "NEED_HELP":
        Object.assign(s, { status: "help", value: null, note: e.note, helpOpen: true });
        break;
      case "UNDONE":
        Object.assign(s, { status: "open", value: null, note: null });
        break;
      case "COACH_REPLY":
        s.replies.push({ note: e.note ?? "", at: e.createdAt.toISOString() });
        s.helpOpen = false;
        break;
    }
  }
  return s;
}

export interface Progress {
  /** Task occurrences due from day 1 to the last day counted. */
  due: number;
  done: number;
  skipped: number;
  /** Days on which she marked at least one task done. */
  activeDays: number;
}

/**
 * Counts due, done and skipped occurrences from day 1 through `throughDay`. Engagement only: it says what she did with
 * her plan, never anything about her health.
 */
export function progressOf(
  tasks: (Schedulable & { id: string })[],
  eventsByTaskDate: Map<string, TaskEventLike[]>,
  startIso: string,
  throughDay: number
): Progress {
  const p: Progress = { due: 0, done: 0, skipped: 0, activeDays: 0 };
  for (let day = 1; day <= throughDay; day++) {
    const iso = dateOfDay(startIso, day);
    const wd = weekdayOf(iso);
    let any = false;
    for (const t of tasks) {
      if (!isDue(t, day, wd)) continue;
      p.due++;
      const st = stateOf(eventsByTaskDate.get(t.id + "|" + iso) ?? []).status;
      if (st === "done") {
        p.done++;
        any = true;
      } else if (st === "skipped") p.skipped++;
    }
    if (any) p.activeDays++;
  }
  return p;
}
