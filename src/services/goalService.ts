import { delay } from "./apiClient";
import { mockGoals } from "@/mock/seed";
import type { Goal } from "@/types";

export const goalService = {
  async list(): Promise<Goal[]> {
    return delay(mockGoals);
  },
  async create(input: { title: string; category: Goal["category"]; target: string; reminder?: string }): Promise<Goal> {
    const goal: Goal = { id: `g_${Date.now()}`, progress: 0, completed: false, ...input };
    return delay(goal, 350);
  },
};
