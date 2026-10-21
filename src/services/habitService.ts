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
}

export const habitService = {
  async list(): Promise<Habit[]> {
    return (await request<ApiHabit[]>(`/habits?${today()}`)).map(toFrontendHabit);
  },
  async create(input: HabitInput): Promise<Habit> {
    return toFrontendHabit(await request<ApiHabit>(`/habits?${today()}`, { method: "POST", body: JSON.stringify(input) }));
  },
  async update(id: string, patch: Partial<HabitInput> & { archived?: boolean }): Promise<Habit> {
    return toFrontendHabit(await request<ApiHabit>(`/habits/${id}?${today()}`, { method: "PATCH", body: JSON.stringify(patch) }));
  },
  async remove(id: string): Promise<void> {
    await request(`/habits/${id}`, { method: "DELETE" });
  },
  /** Today's tap. With no amount, a habit that has a target is logged at the target (one tap = done). */
  async log(id: string, amount?: number): Promise<Habit> {
    return toFrontendHabit(
      await request<ApiHabit>(`/habits/${id}/logs/${localDateISO()}`, { method: "PUT", body: JSON.stringify(amount === undefined ? {} : { amount }) })
    );
  },
  async unlog(id: string): Promise<Habit> {
    return toFrontendHabit(await request<ApiHabit>(`/habits/${id}/logs/${localDateISO()}`, { method: "DELETE" }));
  },
  /** Fix a day she missed: log (or clear) a specific recent day. */
  async logOn(id: string, day: string, done: boolean): Promise<Habit> {
    return toFrontendHabit(
      await request<ApiHabit>(`/habits/${id}/logs/${day}?${today()}`, done ? { method: "PUT", body: JSON.stringify({}) } : { method: "DELETE" })
    );
  },
};
