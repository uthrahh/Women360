import { request } from "./apiClient";
import type { NutritionSummary, MealEntry } from "@/types";
import { localDateISO, toBackendMealEntry, toFrontendMealEntry, toFrontendNutritionSummary } from "./mappers";

export const nutritionService = {
  async getToday(): Promise<NutritionSummary> {
    const apiSummary = await request<Parameters<typeof toFrontendNutritionSummary>[0]>(
      `/nutrition/today?date=${localDateISO()}`
    );
    return toFrontendNutritionSummary(apiSummary);
  },
  async addMeal(meal: Omit<MealEntry, "id">): Promise<MealEntry> {
    const apiMeal = await request<Parameters<typeof toFrontendMealEntry>[0]>("/nutrition/meals", {
      method: "POST",
      body: JSON.stringify(toBackendMealEntry(meal, localDateISO())),
    });
    return toFrontendMealEntry(apiMeal);
  },
  async updateMeal(id: string, meal: Partial<Omit<MealEntry, "id">>): Promise<MealEntry> {
    const apiMeal = await request<Parameters<typeof toFrontendMealEntry>[0]>(`/nutrition/meals/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        time: meal.time,
        name: meal.name,
        calories: meal.calories,
        proteinG: meal.protein,
        fibreG: meal.fibre,
        servings: meal.servings,
        carbsG: meal.carbs,
        fatG: meal.fat,
        notes: meal.notes,
      }),
    });
    return toFrontendMealEntry(apiMeal);
  },
  async deleteMeal(id: string): Promise<void> {
    await request(`/nutrition/meals/${id}`, { method: "DELETE" });
  },
  async logHydration(amountMl: number): Promise<void> {
    await request("/nutrition/hydration", {
      method: "POST",
      body: JSON.stringify({ date: localDateISO(), amountMl }),
    });
  },
  async logFruitVeg(servings: number): Promise<void> {
    await request("/nutrition/fruit-veg", {
      method: "POST",
      body: JSON.stringify({ date: localDateISO(), servings }),
    });
  },
};
