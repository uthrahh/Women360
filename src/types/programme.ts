// Guided programmes: what the web app reads from /programmes (her), /coach/programme (her coach) and /admin/programme.

export type TaskCategory = "NUTRITION" | "HYDRATION" | "ACTIVITY" | "SLEEP" | "WELLBEING" | "WOMENS_HEALTH" | "FAMILY" | "LEARNING" | "PROFESSIONAL";
export type TaskKind = "CHECK" | "AMOUNT" | "REFLECTION";
export type TaskFrequency = "DAILY" | "WEEKDAYS" | "ONCE";
export type EnrolmentStatus = "ASSESSING" | "WAITING_FOR_COACH" | "PLANNING" | "ACTIVE" | "FINAL_ASSESSMENT" | "FINAL_REVIEW" | "COMPLETED" | "LEFT";
export type AssessmentKind = "BASELINE" | "FINAL";
export type Answers = Record<string, string | number | string[]>;

type QBase = { id: string; label: string; required: boolean; section: "goals" | "routine" | "you" };
export type Question =
  | (QBase & { type: "multi"; options: { value: string; label: string }[]; maxPick: number })
  | (QBase & { type: "choice"; options: { value: string; label: string }[] })
  | (QBase & { type: "number"; min: number; max: number; unit?: string })
  | (QBase & { type: "scale"; lowLabel: string; highLabel: string })
  | (QBase & { type: "text"; maxLength: number });

export interface Questionnaire {
  schemaVersion: number;
  questions: Question[];
}

export interface DayState {
  status: "open" | "done" | "skipped" | "help";
  value: number | null;
  note: string | null;
  helpOpen: boolean;
  replies: { note: string; at: string }[];
}

export interface ProgrammeTask {
  id: string;
  title: string;
  category: TaskCategory;
  kind: TaskKind;
  unit: string | null;
  target: number | null;
  instructions: string;
  safetyNotes: string | null;
  frequency: TaskFrequency;
  weekdays: number[];
  startDay: number;
  endDay: number;
  status: "ACTIVE" | "PAUSED" | "STOPPED" | "REPLACED";
  published: boolean;
  endedOnDay: number | null;
  fromTemplate: boolean;
}

export interface Progress {
  due: number;
  done: number;
  skipped: number;
  activeDays: number;
}

export interface PlanChange {
  version: number;
  reason: string;
  at: string;
}

export interface CoachReview {
  kind: "WEEKLY" | "FINAL";
  notes: string;
  at: string;
}

export interface ProgrammeSummary {
  id: string;
  name: string;
  summary: string;
  durationDays: number;
}

export interface MyProgramme {
  current: null | {
    id: string;
    status: EnrolmentStatus;
    programme: { name: string; summary: string; durationDays: number };
    coach: { name: string } | null;
    startDate: string | null;
    day: number | null;
    nextReviewOn: string | null;
    baseline: { answers: Answers; submittedAt: string | null } | null;
    final: { answers: Answers; submittedAt: string | null } | null;
    days: { date: string; day: number; tasks: (ProgrammeTask & { state: DayState })[] }[];
    progress: Progress | null;
    changes: PlanChange[];
    reviews: CoachReview[];
    comparison: { id: string; before: Answers[string] | null; after: Answers[string] | null }[] | null;
  };
  available: ProgrammeSummary[];
}

export interface CaseloadItem {
  id: string;
  name: string;
  programme: string;
  status: EnrolmentStatus;
  day: number | null;
  durationDays: number;
  helpOpen: number;
  lastActivity: string | null;
  nextReviewOn: string | null;
}

export interface CoachEnrolment {
  id: string;
  name: string;
  status: EnrolmentStatus;
  programme: { name: string; durationDays: number };
  startDate: string | null;
  day: number | null;
  planVersion: number;
  nextReviewOn: string | null;
  baseline: { answers: Answers; submittedAt: string; schemaVersion: number } | null;
  final: { answers: Answers; submittedAt: string; schemaVersion: number } | null;
  tasks: ProgrammeTask[];
  recent: { date: string; day: number; items: { taskId: string; title: string; state: DayState }[] }[];
  helpRequests: { taskId: string; date: string; title: string; note: string | null }[];
  progress: Progress | null;
  changes: PlanChange[];
  reviews: CoachReview[];
}

export interface TaskTemplate {
  id: string;
  title: string;
  category: TaskCategory;
  kind: TaskKind;
  unit: string | null;
  instructions: string;
  safetyNotes: string | null;
  status: "DRAFT" | "APPROVED" | "RETIRED";
  reviewedBy: string | null;
  reviewedAt: string | null;
}

export interface TaskDraft {
  templateId?: string | null;
  title: string;
  category: TaskCategory;
  kind: TaskKind;
  unit?: string | null;
  target?: number | null;
  instructions: string;
  safetyNotes?: string | null;
  frequency: TaskFrequency;
  weekdays?: number[];
  startDay: number;
  endDay: number;
}

export interface AdminProgramme {
  id: string;
  name: string;
  summary: string;
  durationDays: number;
  status: "DRAFT" | "PUBLISHED" | "RETIRED";
  enrolments: number;
}

export interface AdminEnrolment {
  id: string;
  name: string;
  programme: string;
  status: EnrolmentStatus;
  coach: { id: string; name: string } | null;
  joinedAt: string;
}

export const CATEGORY_LABEL: Record<TaskCategory, string> = {
  NUTRITION: "Food",
  HYDRATION: "Water",
  ACTIVITY: "Movement",
  SLEEP: "Sleep",
  WELLBEING: "Wellbeing",
  WOMENS_HEALTH: "Women's health",
  FAMILY: "Family",
  LEARNING: "Learning",
  PROFESSIONAL: "Appointment",
};

export const STATUS_LABEL: Record<EnrolmentStatus, string> = {
  ASSESSING: "Answering questions",
  WAITING_FOR_COACH: "Waiting for a coach",
  PLANNING: "Plan being prepared",
  ACTIVE: "Running",
  FINAL_ASSESSMENT: "Final questions",
  FINAL_REVIEW: "Waiting for final review",
  COMPLETED: "Completed",
  LEFT: "Left",
};

export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Every day", "Mon, Wed and Fri", "Once, on day 5", with the day range when it is not the whole programme. */
export function scheduleText(t: Pick<ProgrammeTask, "frequency" | "weekdays" | "startDay" | "endDay">, durationDays?: number): string {
  if (t.frequency === "ONCE") return `Once, on day ${t.startDay}`;
  const days = t.frequency === "DAILY" ? "Every day" : joinList(t.weekdays.map((d) => WEEKDAY_SHORT[d]));
  const whole = t.startDay === 1 && (durationDays === undefined || t.endDay === durationDays);
  return whole ? days : `${days}, days ${t.startDay} to ${t.endDay}`;
}

export function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return items.slice(0, -1).join(", ") + " and " + items[items.length - 1];
}

/** Her answers as plain text, for her coach or her own report. */
export function answerText(q: Question | undefined, v: Answers[string] | null | undefined): string {
  if (v === null || v === undefined || v === "") return "Not answered";
  if (!q) return Array.isArray(v) ? v.join(", ") : String(v);
  switch (q.type) {
    case "multi":
      return (Array.isArray(v) ? v : []).map((x) => q.options.find((o) => o.value === x)?.label ?? x).join(", ");
    case "choice":
      return q.options.find((o) => o.value === v)?.label ?? String(v);
    case "scale":
      return `${v} of 5`;
    case "number":
      return `${v}${q.unit ? " " + q.unit : ""}`;
    default:
      return String(v);
  }
}
