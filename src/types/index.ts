export type Role = "woman" | "coach" | "admin";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  dateOfBirth: string | null; // ISO date; null until the user provides one
  avatarInitials: string;
  lifeStage: "reproductive" | "perimenopause" | "menopause" | "postmenopause" | null;
  onboarded: boolean;
}

export interface SeniorEssential {
  key: SeniorEssentialKey;
  label: string;
  enabled: boolean;
}

export type SeniorEssentialKey =
  | "health"
  | "medicines"
  | "appointments"
  | "activity"
  | "sleep"
  | "nutrition"
  | "messages"
  | "cycle"
  | "emergency";

export interface CycleDay {
  date: string;
  isPeriod: boolean;
  flow?: "spotting" | "light" | "medium" | "heavy";
  pain?: number; // 0-4
  mood?: string;
  energy?: number; // 0-4
  symptoms?: string[];
  notes?: string;
}

export interface CycleSummary {
  // null for a brand-new user who hasn't logged any cycle data yet.
  currentDay: number | null;
  phase: "menstrual" | "follicular" | "ovulation" | "luteal" | null;
  cycleLength: number;
  periodLength: number;
  nextPeriodDate: string | null;
  lastCycleLengths: number[];
  history: CycleDay[];
}

export interface MealEntry {
  id: string;
  time: string;
  name: string;
  calories: number;
  protein: number;
  fibre: number;
  servings: string;
  carbs?: number;
  fat?: number;
  notes?: string;
}

export interface NutritionSummary {
  date: string;
  hydrationMl: number;
  hydrationGoalMl: number;
  calories: number;
  proteinG: number;
  proteinGoalG: number;
  carbsG: number;
  fatG: number;
  fibreG: number;
  fibreGoalG: number;
  fruitVeg: number;
  fruitVegGoal: number;
  meals: MealEntry[];
}

export interface ActivityEntry {
  id: string;
  type: string;
  duration: number; // minutes
  intensity: "low" | "moderate" | "high";
  notes?: string;
  date: string;
}

export interface ActivitySummary {
  steps: number;
  stepsGoal: number;
  activeMinutes: number;
  activeMinutesGoal: number;
  weeklyMinutes: { day: string; minutes: number }[];
  entries: ActivityEntry[];
}

export interface SleepEntry {
  id: string;
  date: string;
  bedtime: string;
  wakeTime: string;
  durationHours: number;
  quality: number; // 1-5 (1 Very poor .. 5 Excellent), never a percentage
  notes?: string;
}

export const SLEEP_QUALITY_LABELS: Record<number, string> = {
  1: "Very poor",
  2: "Poor",
  3: "Fair",
  4: "Good",
  5: "Excellent",
};

export interface SleepSummary {
  durationHours: number;
  quality: number; // 1-5 (1 Very poor .. 5 Excellent), never a percentage
  bedtime: string;
  wakeTime: string;
  weeklyHours: { day: string; hours: number }[];
  consistencyScore: number;
  history: SleepEntry[];
}

export interface WellbeingEntry {
  date: string;
  mood: number; // 0-4
  stress: number; // 0-4
  energy: number; // 0-4
  note?: string;
}

export interface Goal {
  id: string;
  title: string;
  category: "sleep" | "activity" | "hydration" | "nutrition" | "strength" | "cycle" | "mobility";
  currentValue: number;
  targetValue: number;
  unit: string;
  reminder?: string;
  completed: boolean;
}

export interface Appointment {
  id: string;
  title: string;
  provider: string;
  date: string;
  time: string;
  location: string;
  kind: "checkup" | "screening" | "vaccination" | "coach";
}

export interface Medication {
  id: string;
  name: string;
  dose: string;
  schedule: string;
  remaining?: number;
}

export interface Message {
  id: string;
  from: string;
  preview: string;
  time: string;
  unread: boolean;
}

export interface LearnArticle {
  id: string;
  title: string;
  category: string;
  readMins: number;
  dek: string;
}

export interface VitalMeasurement {
  id: string;
  type: "weight" | "bloodPressure" | "restingHR";
  value: string;
  date: string;
}

export interface ReportRecord {
  id: string;
  title: string;
  generatedOn: string;
  range: string;
}

// The full data snapshot behind one report record — same numbers the
// Nutrition/Sleep/Cycle/Goals pages themselves read from, computed once at
// generation time from the actual stored records for that period.
export interface HealthReportSnapshot {
  rangeDays: number;
  profile: { name: string; lifeStage: string | null };
  nutrition: {
    daysLogged: number;
    totalMealsLogged: number;
    avgCaloriesPerLoggedDay: number | null;
    avgProteinGPerLoggedDay: number | null;
    avgFibreGPerLoggedDay: number | null;
    avgCarbsGPerLoggedDay: number | null;
    avgFatGPerLoggedDay: number | null;
    avgHydrationMlPerLoggedDay: number | null;
    totalFruitVegServings: number;
  };
  sleep: { entryCount: number; avgDurationHours: number | null; avgQuality: number | null };
  activity: { entryCount: number; totalMinutes: number };
  wellbeing: { entryCount: number; avgMood: number | null; avgStress: number | null; avgEnergy: number | null };
  cycle: {
    hasData: boolean;
    currentDay: number | null;
    phase: string | null;
    averageCycleLengthDays: number;
    averagePeriodLengthDays: number;
    estimatedNextPeriodDate: string | null;
  };
  goals: {
    active: { title: string; category: string; currentValue: number; targetValue: number; unit: string; progressPct: number }[];
    completed: { title: string; category: string }[];
  };
  vitals: { type: string; value: string; date: string }[];
}

export interface HealthReportDetail {
  title: string;
  rangeLabel: string;
  generatedOn: string;
  dataSnapshot: HealthReportSnapshot;
}

export interface AppNotification {
  id: string;
  title: string;
  detail: string;
  time: string;
  read: boolean;
}

export interface InsightsSummary {
  sleepMood: { sleep: number; mood: number }[];
  cards: { q: string; a: string }[];
}
