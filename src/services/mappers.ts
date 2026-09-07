/**
 * The backend (server/) uses UPPER_SNAKE_CASE enums and a few different
 * field names than the frontend's mock-era types. These functions are the
 * one place that vocabulary gets translated, so every service can keep
 * returning exactly the shapes features already expect.
 */
import type { CycleDay, CycleSummary, MealEntry, NutritionSummary, Role, User } from "@/types";

export function lower<T extends string>(value: string): T {
  return value.toLowerCase() as T;
}

export function upper<T extends string>(value: string): T {
  return value.toUpperCase() as T;
}

function toDateOnly(value: string | null): string | null {
  return value ? value.slice(0, 10) : null;
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

interface ApiUser {
  id: string;
  name: string;
  email: string;
  role: string;
  dateOfBirth: string | null;
  lifeStage: string | null;
  avatarInitials: string | null;
  onboarded: boolean;
}

export function toFrontendUser(apiUser: ApiUser): User {
  return {
    id: apiUser.id,
    name: apiUser.name,
    email: apiUser.email,
    role: lower<Role>(apiUser.role),
    dateOfBirth: toDateOnly(apiUser.dateOfBirth),
    avatarInitials: apiUser.avatarInitials ?? initialsFromName(apiUser.name),
    lifeStage: apiUser.lifeStage ? lower<User["lifeStage"] & string>(apiUser.lifeStage) : null,
    onboarded: apiUser.onboarded,
  };
}

interface ApiCycleEntry {
  date: string;
  isPeriod: boolean;
  flow: string | null;
  pain: number | null;
  energy: number | null;
  mood: string | null;
  symptoms: string[];
  notes: string | null;
}

export function toFrontendCycleDay(entry: ApiCycleEntry): CycleDay {
  return {
    date: toDateOnly(entry.date) ?? entry.date,
    isPeriod: entry.isPeriod,
    flow: entry.flow ? lower<CycleDay["flow"] & string>(entry.flow) : undefined,
    pain: entry.pain ?? undefined,
    mood: entry.mood ?? undefined,
    energy: entry.energy ?? undefined,
    symptoms: entry.symptoms,
    notes: entry.notes ?? undefined,
  };
}

interface ApiCycleSummary {
  currentDay: number | null;
  phase: string | null;
  cycleLength: number;
  periodLength: number;
  nextPeriodDate: string | null;
  lastCycleLengths: number[];
  history: ApiCycleEntry[];
}

export function toFrontendCycleSummary(apiSummary: ApiCycleSummary): CycleSummary {
  return {
    currentDay: apiSummary.currentDay,
    phase: apiSummary.phase as CycleSummary["phase"],
    cycleLength: apiSummary.cycleLength,
    periodLength: apiSummary.periodLength,
    nextPeriodDate: toDateOnly(apiSummary.nextPeriodDate),
    lastCycleLengths: apiSummary.lastCycleLengths,
    history: apiSummary.history.map(toFrontendCycleDay),
  };
}

// The backend's PUT /cycle/entries/:date takes the date as a path param, and
// defaults isPeriod to false if omitted — the frontend's log form only ever
// sends a flow value on a period day, so we infer isPeriod from that when
// the caller hasn't set it explicitly.
export function toBackendCycleEntry(entry: Partial<CycleDay>) {
  return {
    isPeriod: entry.isPeriod ?? Boolean(entry.flow),
    flow: entry.flow ? upper(entry.flow) : undefined,
    pain: entry.pain,
    energy: entry.energy,
    mood: entry.mood,
    symptoms: entry.symptoms,
    notes: entry.notes,
  };
}

interface ApiMealEntry {
  id: string;
  time: string;
  name: string;
  calories: number;
  proteinG: number;
  fibreG: number;
  servings: string;
}

export function toFrontendMealEntry(apiMeal: ApiMealEntry): MealEntry {
  return {
    id: apiMeal.id,
    time: apiMeal.time,
    name: apiMeal.name,
    calories: apiMeal.calories,
    protein: apiMeal.proteinG,
    fibre: apiMeal.fibreG,
    servings: apiMeal.servings,
  };
}

export function toBackendMealEntry(meal: Omit<MealEntry, "id">, date: string) {
  return {
    date,
    time: meal.time,
    name: meal.name,
    calories: meal.calories,
    proteinG: meal.protein,
    fibreG: meal.fibre,
    servings: meal.servings,
  };
}

interface ApiNutritionSummary {
  date: string;
  hydrationMl: number;
  hydrationGoalMl: number;
  proteinG: number;
  proteinGoalG: number;
  fibreG: number;
  fibreGoalG: number;
  fruitVeg: number;
  fruitVegGoal: number;
  meals: ApiMealEntry[];
}

export function toFrontendNutritionSummary(apiSummary: ApiNutritionSummary): NutritionSummary {
  return { ...apiSummary, meals: apiSummary.meals.map(toFrontendMealEntry) };
}
