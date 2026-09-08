import { request } from "./apiClient";
import type { Goal } from "@/types";
import { toBackendGoalInput, toFrontendGoal, upper } from "./mappers";

export const goalService = {
  async list(): Promise<Goal[]> {
    const apiGoals = await request<Parameters<typeof toFrontendGoal>[0][]>("/goals");
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
    const apiGoal = await request<Parameters<typeof toFrontendGoal>[0]>("/goals", {
      method: "POST",
      body: JSON.stringify(toBackendGoalInput(input)),
    });
    return toFrontendGoal(apiGoal);
  },
  async update(
    id: string,
    patch: Partial<{ title: string; category: Goal["category"]; currentValue: number; targetValue: number; unit: string; reminder: string; completed: boolean }>
  ): Promise<Goal> {
    const apiGoal = await request<Parameters<typeof toFrontendGoal>[0]>(`/goals/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ ...patch, category: patch.category ? upper(patch.category) : undefined }),
    });
    return toFrontendGoal(apiGoal);
  },
  async remove(id: string): Promise<void> {
    await request(`/goals/${id}`, { method: "DELETE" });
  },
};
