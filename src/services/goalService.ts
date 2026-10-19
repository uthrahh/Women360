import { request } from "./apiClient";
import type { Goal } from "@/types";
import { toBackendGoalInput, toFrontendGoal, upper, type GoalInput } from "./mappers";

type ApiGoal = Parameters<typeof toFrontendGoal>[0];

export const goalService = {
  async list(): Promise<Goal[]> {
    const apiGoals = await request<ApiGoal[]>("/goals");
    return apiGoals.map(toFrontendGoal);
  },
  async create(input: GoalInput): Promise<Goal> {
    const apiGoal = await request<ApiGoal>("/goals", { method: "POST", body: JSON.stringify(toBackendGoalInput(input)) });
    return toFrontendGoal(apiGoal);
  },
  async update(
    id: string,
    patch: Partial<{
      title: string;
      category: Goal["category"];
      currentValue: number;
      targetValue: number;
      unit: string;
      reminder: string;
      completed: boolean;
      /** null clears the due date */
      dueDate: string | null;
    }>
  ): Promise<Goal> {
    const apiGoal = await request<ApiGoal>(`/goals/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ ...patch, category: patch.category ? upper(patch.category) : undefined }),
    });
    return toFrontendGoal(apiGoal);
  },
  async remove(id: string): Promise<void> {
    await request(`/goals/${id}`, { method: "DELETE" });
  },
};
