export type Role = "woman" | "coach" | "admin";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  dateOfBirth: string; // ISO date
  avatarInitials: string;
  lifeStage: "reproductive" | "perimenopause" | "menopause" | "postmenopause";
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
  currentDay: number;
  phase: "menstrual" | "follicular" | "ovulation" | "luteal";
  cycleLength: number;
  periodLength: number;
  nextPeriodDate: string;
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
}

export interface NutritionSummary {
  date: string;
  hydrationMl: number;
  hydrationGoalMl: number;
  proteinG: number;
  proteinGoalG: number;
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

export interface SleepSummary {
  durationHours: number;
  quality: number; // 0-100
  bedtime: string;
  wakeTime: string;
  weeklyHours: { day: string; hours: number }[];
  consistencyScore: number;
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
  target: string;
  progress: number; // 0-100
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
