import { delay } from "./apiClient";
import { mockNutrition } from "@/mock/seed";
import type { NutritionSummary, MealEntry } from "@/types";

export const nutritionService = {
  async getToday(): Promise<NutritionSummary> {
    return delay(mockNutrition);
  },
  async addMeal(meal: Omit<MealEntry, "id">): Promise<MealEntry> {
    const entry = { ...meal, id: `m_${Date.now()}` };
    return delay(entry, 350);
  },
};
