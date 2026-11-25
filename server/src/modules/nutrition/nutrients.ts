/**
 * The nutrients a person can set a daily target for.
 *
 * Where each one's total comes from:
 *  - protein, carbs, fat and fibre: added up from the day's meals,
 *  - water: the day's hydration taps, fruit and veg: the day's servings,
 *  - vitamins and minerals: the optional amounts she typed on a meal ("More nutrients").
 *
 * There are deliberately NO suggested amounts here, except the four that were always on the page (protein, fibre, water and
 * fruit and veg, still stored in NutritionGoal). A recommended intake for iron or sodium is a medical claim that depends on age,
 * pregnancy and conditions, so the person types the number her doctor or dietitian gave her. Calories are left out on purpose:
 * a calorie target is the feature most linked to unhealthy tracking (docs/CRAFT.md), and nothing here asks for one.
 */
export type NutrientGroup = "main" | "micro";

export interface NutrientDef {
  code: string;
  label: string;
  unit: string;
  group: NutrientGroup;
  /** Largest value accepted for one target or one meal's amount. */
  max: number;
  /** Where the day's total comes from. */
  source: "meal" | "micro" | "hydration" | "fruitVeg";
  /** Whole numbers only (water in ml, servings). */
  whole?: boolean;
  /** A ceiling is the more natural target (sodium). It is only the suggested choice; she can pick either. */
  usuallyAtMost?: boolean;
}

export const NUTRIENTS: NutrientDef[] = [
  { code: "protein", label: "Protein", unit: "g", group: "main", max: 500, source: "meal" },
  { code: "carbs", label: "Carbohydrates", unit: "g", group: "main", max: 1000, source: "meal" },
  { code: "fat", label: "Fat", unit: "g", group: "main", max: 500, source: "meal" },
  { code: "fibre", label: "Fibre", unit: "g", group: "main", max: 200, source: "meal" },
  { code: "water", label: "Water", unit: "ml", group: "main", max: 6000, source: "hydration", whole: true },
  { code: "fruitveg", label: "Fruit and vegetables", unit: "servings", group: "main", max: 20, source: "fruitVeg", whole: true },
  { code: "iron", label: "Iron", unit: "mg", group: "micro", max: 200, source: "micro" },
  { code: "calcium", label: "Calcium", unit: "mg", group: "micro", max: 5000, source: "micro" },
  { code: "vitamin-d", label: "Vitamin D", unit: "mcg", group: "micro", max: 500, source: "micro" },
  { code: "vitamin-b12", label: "Vitamin B12", unit: "mcg", group: "micro", max: 5000, source: "micro" },
  { code: "vitamin-c", label: "Vitamin C", unit: "mg", group: "micro", max: 5000, source: "micro" },
  { code: "folate", label: "Folate", unit: "mcg", group: "micro", max: 5000, source: "micro" },
  { code: "magnesium", label: "Magnesium", unit: "mg", group: "micro", max: 2000, source: "micro" },
  { code: "zinc", label: "Zinc", unit: "mg", group: "micro", max: 200, source: "micro" },
  { code: "potassium", label: "Potassium", unit: "mg", group: "micro", max: 10000, source: "micro" },
  { code: "sodium", label: "Sodium", unit: "mg", group: "micro", max: 20000, source: "micro", usuallyAtMost: true },
];

export const NUTRIENT_CODES = NUTRIENTS.map((n) => n.code) as [string, ...string[]];
export const MICRO_CODES = NUTRIENTS.filter((n) => n.group === "micro").map((n) => n.code) as [string, ...string[]];
export const nutrientByCode = (code: string): NutrientDef | undefined => NUTRIENTS.find((n) => n.code === code);

/** The four that live in NutritionGoal (always shown, with a usual starting amount). */
export const LEGACY_GOAL_FIELD = {
  protein: "proteinGoalG",
  fibre: "fibreGoalG",
  water: "hydrationGoalMl",
  fruitveg: "fruitVegGoal",
} as const;
export type LegacyCode = keyof typeof LEGACY_GOAL_FIELD;
export const isLegacy = (code: string): code is LegacyCode => code in LEGACY_GOAL_FIELD;

export const round1 = (value: number): number => Math.round(value * 10) / 10;

/** One decimal place at most, the same rule meals already use. */
export const hasAtMostOneDecimal = (value: number): boolean => Math.round(value * 100) % 10 === 0;
