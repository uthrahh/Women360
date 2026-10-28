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
  /** A shared demonstration account: it can look around but not change shared settings. */
  isDemo?: boolean;
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
  // Why the cycle this period ended was unusual, and whether to leave that
  // cycle out of predictions. Set on a period's start day.
  contextTags?: string[];
  excludeCycle?: boolean;
}

export interface CycleSummary {
  // null for a brand-new user who hasn't logged any cycle data yet.
  currentDay: number | null;
  // "late" once today has passed the predicted range with no new period
  // logged — never reported as "luteal" indefinitely.
  phase: "menstrual" | "follicular" | "ovulation" | "luteal" | "late" | null;
  isLate: boolean;
  daysLate: number;
  cycleLength: number;
  periodLength: number;
  // The average of the user's own logged period lengths when there's at
  // least one completed period, null otherwise (periodLength then falls
  // back to the CycleProfile value).
  loggedPeriodLength: number | null;
  nextPeriodDate: string | null;
  // A range, not a false-precise single date — width reflects how
  // consistent this user's own recent cycles have actually been.
  nextPeriodRangeStart: string | null;
  nextPeriodRangeEnd: string | null;
  fertileWindowStart: string | null;
  fertileWindowEnd: string | null;
  // "low" when history is thin, cycles have been irregular, or the user is
  // in perimenopause — the UI must never present a low-confidence estimate
  // with the same certainty as a high-confidence one.
  confidence: "low" | "medium" | "high";
  irregularityNote: string | null;
  lastCycleLengths: number[];
  // How the prediction was built, so the UI can explain itself.
  predictionBasis: {
    usedProfileDefault: boolean;
    rangeHalfWidth: number;
    excludedCycles: number;
  };
  history: CycleDay[];
}

export interface CycleProfileSettings {
  averageCycleLength: number;
  averagePeriodLength: number;
}

export interface CycleDayPhase {
  date: string;
  phase: "menstrual" | "follicular" | "ovulation" | "luteal" | null;
  // False only for a day inside an actually-logged period — every other
  // phase (including a menstrual day that's a projected future period) is
  // an estimate from the pattern, not a logged fact.
  estimated: boolean;
}

export interface CyclePhaseCalendar {
  days: CycleDayPhase[];
  cycleLength: number;
  periodLength: number;
}

export interface MealEntry {
  id: string;
  time: string;
  name: string;
  calories: number;
  protein: number;
  fibre: number;
  servings: string;
  // number|null|undefined: null explicitly clears a previously-saved value
  // on an edit; undefined means "was never entered" when reading a meal.
  carbs?: number | null;
  fat?: number | null;
  notes?: string | null;
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

export type Effort = "low" | "moderate" | "high";

export interface ActivityEntry {
  id: string;
  /** The activity's readable name ("Walking"). */
  type: string;
  /** Which catalog activity; "other" for entries logged before the catalog existed. */
  activityCode: string;
  duration: number; // minutes
  intensity: Effort;
  distanceKm?: number;
  sets?: number;
  /** An estimate from her latest logged weight; null when there is no weight or the activity is unknown. */
  caloriesBurned: number | null;
  notes?: string;
  date: string;
  /** YYYY-MM-DD, for editing; `date` is the friendly "Today" / "Yesterday" label. */
  day: string;
}

/** One of her one-tap activity shortcuts. */
export interface QuickLogItem {
  id: string;
  label: string;
  type: string;
  activityCode: string;
  duration: number;
  intensity: Effort;
  caloriesBurned: number | null;
}

/** One activity she can choose, with the effort levels it actually has. */
export interface CatalogActivity {
  code: string;
  label: string;
  group: string;
  extras: ("distanceKm" | "sets")[];
  levels: { key: "LOW" | "MODERATE" | "HIGH"; label: string; short: string; met: number }[];
}

export interface ActivityCatalog {
  source: { label: string; url: string };
  activities: CatalogActivity[];
}

export interface ActivitySummary {
  steps: number;
  stepsGoal: number;
  activeMinutes: number;
  activeMinutesGoal: number;
  weeklyMinutes: { day: string; minutes: number }[];
  /** Her latest logged weight in kilograms, which the calorie estimates use; null if none. */
  weightKg: number | null;
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

/**
 * What kind of finish line a goal has. "total" builds up to a number (read 12
 * books), "reach" moves a number from where it is to a target (weight 72 -> 67),
 * "oneOff" is a single thing to do (book a check-up). Routines done every day or
 * some days a week are Habits.
 */
export type GoalKind = "total" | "reach" | "oneOff";

export interface Goal {
  id: string;
  title: string;
  category:
    | "sleep" | "activity" | "hydration" | "nutrition" | "strength" | "cycle" | "mobility"
    | "body" | "learning" | "preventive" | "other";
  kind: GoalKind;
  currentValue: number;
  targetValue: number;
  /** Where a "reach" goal started, so progress is measured from there. */
  startValue?: number;
  unit: string;
  reminder?: string;
  completed: boolean;
  /** YYYY-MM-DD, if the goal has a date to aim for. */
  dueDate?: string;
}

/** A routine: every day, or some days a week. With a target it records an amount each day. */
export interface Habit {
  id: string;
  title: string;
  /** Set for an amount habit ("10,000 steps"); absent for one that is simply ticked off. */
  target?: number;
  unit?: string;
  /** 7 = every day. */
  daysPerWeek: number;
  reminder?: string;
  /** A catalog activity code, or "any", when the habit is a physical activity. */
  activityCode?: string;
  doneToday: boolean;
  amountToday?: number;
  /** Consecutive days (daily habits) or weeks (N-a-week habits) that were met. */
  streak: number;
  streakUnit: "day" | "week";
  /** Days done so far this Mon-Sun week. */
  thisWeek: number;
  /** The last seven days, oldest first, ending today. */
  last7: boolean[];
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
  // Structured 24-hour "HH:MM" reminder times — optional, since not every
  // medicine (e.g. an as-needed painkiller) has a fixed daily schedule.
  times?: string[];
  remaining?: number;
}

// A single expected dose for today, derived from a medication's `times` —
// PENDING/OVERDUE are computed, never stored; TAKEN/SKIPPED come from a
// real logged MedicationLog row.
export interface MedicationDose {
  medicationId: string;
  medicationName: string;
  dose: string;
  scheduledFor: string;
  status: "PENDING" | "OVERDUE" | "TAKEN" | "SKIPPED";
}

export interface MedicationAdherence {
  takenCount: number;
  expectedCount: number;
  pct: number | null;
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
    isLate: boolean;
    averageCycleLengthDays: number;
    averagePeriodLengthDays: number;
    estimatedNextPeriodDate: string | null;
    nextPeriodRangeStart: string | null;
    nextPeriodRangeEnd: string | null;
    confidence: "low" | "medium" | "high";
    irregularityNote: string | null;
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

export interface MetricCorrelation {
  labelA: string;
  labelB: string;
  r: number;
  n: number;
  direction: "positive" | "negative";
  strength: "mild" | "moderate" | "strong";
  summary: string;
}

export interface CorrelationsReport {
  correlations: MetricCorrelation[];
  insufficientData: boolean;
  disclaimer: string;
}

export interface InsightsSummary {
  sleepMood: { sleep: number; mood: number }[];
  cards: { q: string; a: string }[];
  correlations: CorrelationsReport;
}

// A ranked, cross-domain "explain this" report — never a diagnosis, always
// grounded in the user's own logged data. See server/.../insights/factors.ts.
export interface FactorReport {
  factors: { label: string; detail: string }[];
  insufficientData: boolean;
  disclaimer: string;
}

export type ScreeningStatus = "needs_dob" | "later" | "beyond" | "not_recorded" | "due" | "soon" | "up_to_date";

/** One recommended check-up, with where the advice comes from and where she stands on it. */
export interface ScreeningItem {
  id: string;
  title: string;
  method: string;
  why: string;
  startAge: number;
  endAge?: number;
  intervalMonths: number;
  note?: string;
  caveats: string[];
  sources: { label: string; url?: string }[];
  status: ScreeningStatus;
  lastDoneOn: string | null;
  nextDueOn: string | null;
  startsInYears: number | null;
  lastRecordId: string | null;
}

export interface ScreeningPlan {
  region: string;
  reviewedOn: string;
  reviewStatus: string;
  disclaimer: string;
  hasDateOfBirth: boolean;
  items: ScreeningItem[];
}

// --- Administration and coaching ---------------------------------------------

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  onboarded: boolean;
  isDemo: boolean;
  createdAt: string;
}

export interface AdminOverview {
  users: { women: number; coaches: number; admins: number; total: number; joinedThisWeek: number };
  feedbackCount: number;
  articles: number;
  auditEventsThisWeek: number;
  scopedToDemo: boolean;
}

export interface AuditEvent {
  id: string;
  actorId: string | null;
  actorRole: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  createdAt: string;
}

export interface FeedbackEntry {
  id: string;
  userId: string;
  rating: number;
  message: string | null;
  createdAt: string;
}

export interface AdminArticle {
  id: string;
  title: string;
  category: string;
  readMins: number;
  dek: string;
  body: string | null;
  publishedAt: string | null;
}

export interface CoachedWoman {
  id: string;
  name: string;
  avatarInitials: string | null;
  lifeStage: string | null;
}

export interface CoachNote {
  id: string;
  note: string;
  visibleToWoman: boolean;
  createdAt: string;
}

/** What a coach may see about one woman who has shared with them (never her health profile or medicines). */
export interface CoachSummary {
  goals: { id: string; title: string; kind: string; currentValue: number; targetValue: number; startValue: number | null; unit: string; completed: boolean }[];
  wellbeing: { date: string; mood: number; stress: number; energy: number }[];
  sleep: { date: string; durationHours: number; quality: number }[];
  activity: { id: string; date: string; type: string; durationMinutes: number; intensity: string }[];
  appointments: { id: string; title: string; date: string; time: string; location: string }[];
}

export interface SharedCoach {
  id: string;
  coach: { id: string; name: string; email: string };
}

export interface NoteFromCoach {
  id: string;
  note: string;
  createdAt: string;
  coach: { name: string };
}

export type ContraceptionMethod =
  | "NONE" | "PILL" | "IUD_COPPER" | "IUD_HORMONAL" | "IMPLANT" | "INJECTION" | "CONDOM" | "NATURAL_METHODS" | "STERILISATION" | "OTHER";
export type PregnancyStatus = "NOT_PREGNANT" | "TRYING_TO_CONCEIVE" | "PREGNANT" | "POSTPARTUM";

export interface ReproductiveHealth {
  contraception: ContraceptionMethod | null;
  pregnancyStatus: PregnancyStatus | null;
  expectedDueDate: string | null;
  notes: string | null;
}

// ---- Personalised activity plans (built on the server from her own data) ----

export type PlanGoal = "HEALTH" | "STRENGTH" | "STAMINA" | "BALANCE" | "STRESS";
export type PlanKind = "AEROBIC" | "STRENGTH" | "MOBILITY";
export type PlanFeasibilityLevel = "ALREADY_THERE" | "COMFORTABLE" | "ACHIEVABLE" | "STRETCH" | "LIMITED_BY_TIME";

export interface PlanSession {
  date: string;
  /** ISO weekday, 1 = Monday ... 7 = Sunday. */
  weekday: number;
  kind: PlanKind;
  activityCode: string;
  label: string;
  intensity: "LOW" | "MODERATE" | "HIGH";
  effort: string;
  feel: string;
  minutes: number;
  caloriesEstimate: number | null;
  note?: string;
  /** Only on a saved plan: she logged this kind of activity on that day. */
  done?: boolean;
}

export interface PlanWeek {
  week: number;
  startDate: string;
  focus: string;
  aerobicMinutes: number;
  aerobicEquivalent: number;
  strengthSessions: number;
  mobilitySessions: number;
  totalMinutes: number;
  sessions: PlanSession[];
}

export interface PlanFeasibility {
  level: PlanFeasibilityLevel;
  headline: string;
  reasons: string[];
  suggestions: string[];
}

export interface ActivityPlan {
  goal: PlanGoal;
  goalLabel: string;
  weeks: number;
  startDate: string;
  endDate: string;
  aerobicTarget: number;
  startAerobic: number;
  peakAerobic: number;
  feasibility: PlanFeasibility;
  cautions: string[];
  weeksPlan: PlanWeek[];
  source: { label: string; url: string };
  review: { reviewed: boolean; note: string };
}

export interface ActivePlan {
  id: string;
  status: "ACTIVE" | "ENDED";
  createdAt: string;
  plan: ActivityPlan;
  progress: {
    state: "UPCOMING" | "ACTIVE" | "FINISHED";
    currentWeek: number;
    weekDone: { aerobicEquivalent: number; strengthSessions: number; mobilitySessions: number };
  };
}

export interface PlanRequest {
  goal: PlanGoal;
  weeks: number;
  /** ISO weekdays, 1 = Monday ... 7 = Sunday. */
  days: number[];
  sessionMinutes: number;
  activityCodes: string[];
  startDate: string;
}

export interface PlanOptions {
  goals: { code: PlanGoal; label: string; description: string }[];
  weeksChoices: number[];
  aerobicActivities: { code: string; label: string; group: string; available: boolean }[];
  defaults: { goal: PlanGoal; weeks: number; days: number[]; sessionMinutes: number; activityCodes: string[] };
  baseline: { hasHistory: boolean; aerobicMinutesPerWeek: number };
  pregnancy: "PREGNANT" | "POSTPARTUM" | null;
  source: { label: string; url: string };
  review: { reviewed: boolean; note: string };
}
