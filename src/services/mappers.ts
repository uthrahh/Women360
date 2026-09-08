/**
 * The backend (server/) uses UPPER_SNAKE_CASE enums and a few different
 * field names than the frontend's mock-era types. These functions are the
 * one place that vocabulary gets translated, so every service can keep
 * returning exactly the shapes features already expect.
 */
import type {
  ActivityEntry,
  ActivitySummary,
  AppNotification,
  Appointment,
  CycleDay,
  CycleSummary,
  Goal,
  MealEntry,
  Medication,
  Message,
  NutritionSummary,
  ReportRecord,
  Role,
  SleepEntry,
  SleepSummary,
  User,
  VitalMeasurement,
  WellbeingEntry,
} from "@/types";

export function lower<T extends string>(value: string): T {
  return value.toLowerCase() as T;
}

export function upper<T extends string>(value: string): T {
  return value.toUpperCase() as T;
}

function toDateOnly(value: string | null): string | null {
  return value ? value.slice(0, 10) : null;
}

// A user's "today" in their own timezone — `.toISOString().slice(0,10)`
// converts to UTC first, which silently shifts the date for anyone whose
// local calendar day doesn't match UTC's (e.g. evenings west of it).
export function localDateISO(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// The backend's sleep consistency-score parser only understands a trailing
// AM/PM marker — a native <input type="time">'s 24-hour "HH:MM" value must
// be converted before it's sent, and converted back to pre-fill a form.
export function to12Hour(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(":");
  const h = Number(hStr);
  const period = h >= 12 ? "PM" : "AM";
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  return `${displayHour}:${mStr} ${period}`;
}

export function to24Hour(display: string): string {
  const match = /(\d+):(\d+)\s*(AM|PM)/i.exec(display);
  if (!match) return "00:00";
  let h = Number(match[1]) % 12;
  if (match[3].toUpperCase() === "PM") h += 12;
  return `${String(h).padStart(2, "0")}:${match[2]}`;
}

// Handles midnight crossing: 23:00 -> 07:00 is 8 hours, not negative.
export function calcSleepDuration(bedtime24: string, wake24: string): number {
  const [bh, bm] = bedtime24.split(":").map(Number);
  const [wh, wm] = wake24.split(":").map(Number);
  let minutes = wh * 60 + wm - (bh * 60 + bm);
  if (minutes <= 0) minutes += 24 * 60;
  return Math.round((minutes / 60) * 10) / 10;
}

// Nutrition values support up to one decimal place (12 or 12.3, not
// 12.34) — mirrors the backend's identical rule in
// server/src/modules/nutrition/nutrition.validation.ts so a value that
// would be rejected server-side is caught here first. Checking at *100
// rather than a naive `% 0.1` sidesteps binary floating-point error.
export function hasAtMostOneDecimal(value: number): boolean {
  return Math.round(value * 100) % 10 === 0;
}

// Progress is always derived from real numbers, never trusted from a
// separately-stored percentage that could drift out of sync.
export function goalProgress(goal: Pick<Goal, "currentValue" | "targetValue">): number {
  if (goal.targetValue <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100)));
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
  carbsG: number | null;
  fatG: number | null;
  notes: string | null;
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
    carbs: apiMeal.carbsG ?? undefined,
    fat: apiMeal.fatG ?? undefined,
    notes: apiMeal.notes ?? undefined,
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
    carbsG: meal.carbs,
    fatG: meal.fat,
    notes: meal.notes,
  };
}

interface ApiNutritionSummary {
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
  meals: ApiMealEntry[];
}

export function toFrontendNutritionSummary(apiSummary: ApiNutritionSummary): NutritionSummary {
  return { ...apiSummary, meals: apiSummary.meals.map(toFrontendMealEntry) };
}

// --- Display-time formatting -------------------------------------------
// The mock era used opaque, human phrases ("Just now", "Yesterday", "Mon")
// instead of raw timestamps, and no page ever formats these fields itself
// — so the adapter layer produces the same vocabulary from real ISO dates.

export function toRelativeTime(iso: string): string {
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay === 1) return "Yesterday";
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function toRelativeDay(iso: string): string {
  const dateOnly = new Date(toDateOnly(iso) ?? iso);
  const today = new Date(localDateISO());
  const diffDays = Math.round((today.getTime() - dateOnly.getTime()) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago`;
  return dateOnly.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function toWeekdayLabel(iso: string): string {
  return new Date(toDateOnly(iso) ?? iso).toLocaleDateString(undefined, { weekday: "short" });
}

// Shared between WellbeingPage (the mood picker) and DashboardPage (the
// Mood snapshot tile) so both speak the same vocabulary for a 0-4 score.
export const MOOD_LABELS = ["Struggling", "Low", "Okay", "Good", "Great"];

// --- Activity -------------------------------------------------------------

interface ApiActivityEntry {
  id: string;
  type: string;
  durationMinutes: number;
  intensity: string;
  notes: string | null;
  date: string;
}

export function toFrontendActivityEntry(entry: ApiActivityEntry): ActivityEntry {
  return {
    id: entry.id,
    type: entry.type,
    duration: entry.durationMinutes,
    intensity: lower<ActivityEntry["intensity"]>(entry.intensity),
    notes: entry.notes ?? undefined,
    date: toRelativeDay(entry.date),
  };
}

export function toBackendActivityEntry(entry: Omit<ActivityEntry, "id" | "date">, date: string) {
  return {
    date,
    type: entry.type,
    durationMinutes: entry.duration,
    intensity: upper(entry.intensity),
    notes: entry.notes,
  };
}

interface ApiActivitySummary {
  steps: number;
  stepsGoal: number;
  activeMinutes: number;
  activeMinutesGoal: number;
  weeklyMinutes: { day: string; minutes: number }[];
  entries: ApiActivityEntry[];
}

export function toFrontendActivitySummary(apiSummary: ApiActivitySummary): ActivitySummary {
  return { ...apiSummary, entries: apiSummary.entries.map(toFrontendActivityEntry) };
}

// --- Wellbeing --------------------------------------------------------------

interface ApiWellbeingEntry {
  date: string;
  mood: number;
  stress: number;
  energy: number;
  note: string | null;
}

export function toFrontendWellbeingEntry(entry: ApiWellbeingEntry): WellbeingEntry {
  return {
    date: toWeekdayLabel(entry.date),
    mood: entry.mood,
    stress: entry.stress,
    energy: entry.energy,
    note: entry.note ?? undefined,
  };
}

export function toBackendWellbeingEntry(entry: Omit<WellbeingEntry, "date">) {
  return { mood: entry.mood, stress: entry.stress, energy: entry.energy, note: entry.note };
}

// --- Goals ------------------------------------------------------------------

interface ApiGoal {
  id: string;
  title: string;
  category: string;
  currentValue: number;
  targetValue: number;
  unit: string;
  reminder: string | null;
  completed: boolean;
}

export function toFrontendGoal(apiGoal: ApiGoal): Goal {
  return {
    id: apiGoal.id,
    title: apiGoal.title,
    category: lower<Goal["category"]>(apiGoal.category),
    currentValue: apiGoal.currentValue,
    targetValue: apiGoal.targetValue,
    unit: apiGoal.unit,
    reminder: apiGoal.reminder ?? undefined,
    completed: apiGoal.completed,
  };
}

export function toBackendGoalInput(input: {
  title: string;
  category: Goal["category"];
  currentValue: number;
  targetValue: number;
  unit: string;
  reminder?: string;
}) {
  return {
    title: input.title,
    category: upper(input.category),
    currentValue: input.currentValue,
    targetValue: input.targetValue,
    unit: input.unit,
    reminder: input.reminder,
  };
}

// --- Health: appointments, medications, vitals -------------------------------

interface ApiAppointment {
  id: string;
  title: string;
  provider: string;
  date: string;
  time: string;
  location: string;
  kind: string;
}

export function toFrontendAppointment(apiAppointment: ApiAppointment): Appointment {
  return { ...apiAppointment, kind: lower<Appointment["kind"]>(apiAppointment.kind) };
}

export function toBackendAppointment(appointment: Omit<Appointment, "id">) {
  return { ...appointment, kind: upper(appointment.kind) };
}

interface ApiMedication {
  id: string;
  name: string;
  dose: string;
  schedule: string;
  remaining: number | null;
}

export function toFrontendMedication(apiMedication: ApiMedication): Medication {
  return { ...apiMedication, remaining: apiMedication.remaining ?? undefined };
}

// VitalType isn't pure casing (BLOOD_PRESSURE -> bloodPressure removes the
// underscore too), so it needs an explicit lookup rather than lower()/upper().
const VITAL_TYPE_TO_FRONTEND: Record<string, VitalMeasurement["type"]> = {
  WEIGHT: "weight",
  BLOOD_PRESSURE: "bloodPressure",
  RESTING_HR: "restingHR",
};
const VITAL_TYPE_TO_BACKEND: Record<VitalMeasurement["type"], string> = {
  weight: "WEIGHT",
  bloodPressure: "BLOOD_PRESSURE",
  restingHR: "RESTING_HR",
};

interface ApiVitalMeasurement {
  id: string;
  type: string;
  value: string;
  date: string;
}

export function toFrontendVital(apiVital: ApiVitalMeasurement): VitalMeasurement {
  return {
    ...apiVital,
    type: VITAL_TYPE_TO_FRONTEND[apiVital.type] ?? lower(apiVital.type),
    date: toRelativeDay(apiVital.date),
  };
}

export function toBackendVitalType(type: VitalMeasurement["type"]): string {
  return VITAL_TYPE_TO_BACKEND[type];
}

// --- Notifications & messages -------------------------------------------

interface ApiNotification {
  id: string;
  title: string;
  detail: string;
  readAt: string | null;
  createdAt: string;
}

export function toFrontendNotification(apiNotification: ApiNotification): AppNotification {
  return {
    id: apiNotification.id,
    title: apiNotification.title,
    detail: apiNotification.detail,
    time: toRelativeTime(apiNotification.createdAt),
    read: apiNotification.readAt !== null,
  };
}

interface ApiMessage {
  id: string;
  senderLabel: string;
  preview: string;
  readAt: string | null;
  createdAt: string;
}

export function toFrontendMessage(apiMessage: ApiMessage): Message {
  return {
    id: apiMessage.id,
    from: apiMessage.senderLabel,
    preview: apiMessage.preview,
    time: toRelativeTime(apiMessage.createdAt),
    unread: apiMessage.readAt === null,
  };
}

// --- Reports ------------------------------------------------------------

interface ApiReportRecord {
  id: string;
  title: string;
  rangeLabel: string;
  generatedOn: string;
}

export function toFrontendReportRecord(apiReport: ApiReportRecord): ReportRecord {
  return { id: apiReport.id, title: apiReport.title, generatedOn: apiReport.generatedOn, range: apiReport.rangeLabel };
}

// --- Sleep ------------------------------------------------------------

interface ApiSleepEntry {
  id: string;
  date: string;
  bedtime: string;
  wakeTime: string;
  durationHours: number;
  quality: number;
  notes: string | null;
}

export function toFrontendSleepEntry(entry: ApiSleepEntry): SleepEntry {
  return {
    id: entry.id,
    date: toDateOnly(entry.date) ?? entry.date,
    bedtime: entry.bedtime,
    wakeTime: entry.wakeTime,
    durationHours: entry.durationHours,
    quality: entry.quality,
    notes: entry.notes ?? undefined,
  };
}

interface ApiSleepSummary {
  durationHours: number;
  quality: number;
  bedtime: string;
  wakeTime: string;
  weeklyHours: { day: string; hours: number }[];
  consistencyScore: number;
  history: ApiSleepEntry[];
}

export function toFrontendSleepSummary(apiSummary: ApiSleepSummary): SleepSummary {
  return { ...apiSummary, history: apiSummary.history.map(toFrontendSleepEntry) };
}

export function toBackendSleepEntry(entry: { bedtime24: string; wake24: string; quality: number; notes?: string }) {
  return {
    bedtime: to12Hour(entry.bedtime24),
    wakeTime: to12Hour(entry.wake24),
    durationHours: calcSleepDuration(entry.bedtime24, entry.wake24),
    quality: entry.quality,
    notes: entry.notes,
  };
}
