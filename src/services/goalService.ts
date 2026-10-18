import { request } from "./apiClient";
import type { Goal } from "@/types";
import { localDateISO, toBackendGoalInput, toFrontendGoal, upper } from "./mappers";

type ApiGoal = Parameters<typeof toFrontendGoal>[0];

// The server works out streaks against the person's own calendar day, so every
// goal call says what "today" is for them rather than trusting server time.
const today = () => `today=${localDateISO()}`;

export const goalService = {
  async list(): Promise<Goal[]> {
    const apiGoals = await request<ApiGoal[]>(`/goals?${today()}`);
    return apiGoals.map(toFrontendGoal);
  },
  async create(input: {
    title: string;
    category: Goal["category"];
    currentValue: number;
    targetValue: number;
    unit: string;
    reminder?: string;
  }): Promise<Goal> {
    const apiGoal = await request<ApiGoal>(`/goals?${today()}`, {
      method: "POST",
      body: JSON.stringify(toBackendGoalInput(input)),
    });
    return toFrontendGoal(apiGoal);
  },
  async update(
    id: string,
    patch: Partial<{ title: string; category: Goal["category"]; currentValue: number; targetValue: number; unit: string; reminder: string; completed: boolean }>
  ): Promise<Goal> {
    const apiGoal = await request<ApiGoal>(`/goals/${id}?${today()}`, {
      method: "PATCH",
      body: JSON.stringify({ ...patch, category: patch.category ? upper(patch.category) : undefined }),
    });
    return toFrontendGoal(apiGoal);
  },
  async remove(id: string): Promise<void> {
    await request(`/goals/${id}`, { method: "DELETE" });
  },

  /** "I did this today" — idempotent, and returns the goal with its new streak. */
  async checkIn(id: string): Promise<Goal> {
    const apiGoal = await request<ApiGoal>(`/goals/${id}/check-ins`, {
      method: "POST",
      body: JSON.stringify({ date: localDateISO() }),
    });
    return toFrontendGoal(apiGoal);
  },
  async undoCheckIn(id: string): Promise<Goal> {
    const apiGoal = await request<ApiGoal>(`/goals/${id}/check-ins/${localDateISO()}`, { method: "DELETE" });
    return toFrontendGoal(apiGoal);
  },
};
