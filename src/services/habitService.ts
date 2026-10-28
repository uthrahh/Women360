import { request } from "./apiClient";
import type { Habit } from "@/types";
import { localDateISO, toFrontendHabit } from "./mappers";

type ApiHabit = Parameters<typeof toFrontendHabit>[0];

// The server works out streaks against the person's own calendar day, so every
// call says what "today" is for them rather than trusting server time.
const today = () => `today=${localDateISO()}`;

export interface HabitInput {
  title: string;
  target?: number | null;
  unit?: string | null;
  daysPerWeek?: number;
  reminder?: string | null;
  /** A catalog activity code, "any", or null when the habit is not a physical activity. */
  activityCode?: string | null;
}

/** Fired after any change to a habit, so the reminder scheduler reloads its list. */
export const HABITS_CHANGED = "w360:habits-changed";
const changed = <T,>(p: Promise<T>): Promise<T> =>
  p.then((v) => {
    window.dispatchEvent(new Event(HABITS_CHANGED));
    return v;
  });

export const habitService = {
  async list(): Promise<Habit[]> {
    return (await request<ApiHabit[]>(`/habits?${today()}`)).map(toFrontendHabit);
  },
  create(input: HabitInput): Promise<Habit> {
    return changed(request<ApiHabit>(`/habits?${today()}`, { method: "POST", body: JSON.stringify(input) }).then(toFrontendHabit));
  },
  update(id: string, patch: Partial<HabitInput> & { archived?: boolean }): Promise<Habit> {
    return changed(request<ApiHabit>(`/habits/${id}?${today()}`, { method: "PATCH", body: JSON.stringify(patch) }).then(toFrontendHabit));
  },
  remove(id: string): Promise<void> {
    return changed(request<void>(`/habits/${id}`, { method: "DELETE" }));
  },
  /** Today's tap. With no amount, a habit that has a target is logged at the target (one tap = done). */
  log(id: string, amount?: number): Promise<Habit> {
    return changed(
      request<ApiHabit>(`/habits/${id}/logs/${localDateISO()}`, { method: "PUT", body: JSON.stringify(amount === undefined ? {} : { amount }) }).then(toFrontendHabit)
    );
  },
  unlog(id: string): Promise<Habit> {
    return changed(request<ApiHabit>(`/habits/${id}/logs/${localDateISO()}`, { method: "DELETE" }).then(toFrontendHabit));
  },
  /** Fix a day she missed: log (or clear) a specific recent day. */
  logOn(id: string, day: string, done: boolean): Promise<Habit> {
    return changed(
      request<ApiHabit>(`/habits/${id}/logs/${day}?${today()}`, done ? { method: "PUT", body: JSON.stringify({}) } : { method: "DELETE" }).then(toFrontendHabit)
    );
  },
};
