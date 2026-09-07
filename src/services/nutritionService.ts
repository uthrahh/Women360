import { request } from "./apiClient";
import type { NutritionSummary, MealEntry } from "@/types";
import { toBackendMealEntry, toFrontendMealEntry, toFrontendNutritionSummary } from "./mappers";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export const nutritionService = {
  async getToday(): Promise<NutritionSummary> {
    const apiSummary = await request<Parameters<typeof toFrontendNutritionSummary>[0]>(
      `/nutrition/today?date=${todayISO()}`
    );
    return toFrontendNutritionSummary(apiSummary);
  },
  async addMeal(meal: Omit<MealEntry, "id">): Promise<MealEntry> {
    const apiMeal = await request<Parameters<typeof toFrontendMealEntry>[0]>("/nutrition/meals", {
      method: "POST",
      body: JSON.stringify(toBackendMealEntry(meal, todayISO())),
    });
    return toFrontendMealEntry(apiMeal);
  },
};
