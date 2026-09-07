import { request } from "./apiClient";
import type { Goal } from "@/types";
import { toBackendGoalInput, toFrontendGoal } from "./mappers";

export const goalService = {
  async list(): Promise<Goal[]> {
    const apiGoals = await request<Parameters<typeof toFrontendGoal>[0][]>("/goals");
    return apiGoals.map(toFrontendGoal);
  },
  async create(input: { title: string; category: Goal["category"]; target: string; reminder?: string }): Promise<Goal> {
    const apiGoal = await request<Parameters<typeof toFrontendGoal>[0]>("/goals", {
      method: "POST",
      body: JSON.stringify(toBackendGoalInput(input)),
    });
    return toFrontendGoal(apiGoal);
  },
};
