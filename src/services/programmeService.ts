import { request } from "./apiClient";
import { localDateISO } from "./mappers";
import type {
  AdminEnrolment,
  AdminProgramme,
  Answers,
  AssessmentKind,
  CaseloadItem,
  CoachEnrolment,
  DayState,
  MyProgramme,
  ProgrammeTask,
  Questionnaire,
  TaskDraft,
  TaskTemplate,
} from "@/types/programme";

const today = () => localDateISO();
const json = (method: string, body: unknown) => ({ method, body: JSON.stringify(body) });

/** Her side. Every "today" is her own calendar day. */
export const programmeService = {
  mine: () => request<MyProgramme>(`/programmes/me?today=${today()}`),
  questions: (kind: AssessmentKind) => request<Questionnaire>(`/programmes/questions?kind=${kind}`),
  join: (programmeId: string) => request<{ id: string }>(`/programmes/${programmeId}/join`, { method: "POST" }),
  saveAnswers: (kind: AssessmentKind, answers: Answers, submit: boolean) =>
    request<{ saved: boolean; status: string }>("/programmes/me/assessment", json("PUT", { kind, answers, submit })),
  logTask: (taskId: string, body: { date: string; type: "DONE" | "SKIPPED" | "NEED_HELP" | "UNDONE"; value?: number | null; note?: string | null }) =>
    request<DayState>(`/programmes/me/tasks/${taskId}/events?today=${today()}`, json("POST", body)),
  leave: () => request<{ left: boolean }>("/programmes/me/leave", { method: "POST" }),
};

/** Her coach's side: only enrolments an administrator assigned to this coach. */
export const coachProgrammeService = {
  caseload: () => request<CaseloadItem[]>(`/coach/programme/caseload?today=${today()}`),
  detail: (id: string) => request<CoachEnrolment>(`/coach/programme/enrolments/${id}?today=${today()}`),
  templates: (id: string) => request<TaskTemplate[]>(`/coach/programme/enrolments/${id}/templates`),
  questions: (kind: AssessmentKind) => request<Questionnaire>(`/programmes/questions?kind=${kind}`).catch(() => null),
  addTask: (id: string, task: TaskDraft) => request<ProgrammeTask>(`/coach/programme/enrolments/${id}/tasks`, json("POST", task)),
  changeTask: (taskId: string, task: TaskDraft & { reason?: string | null }) =>
    request<ProgrammeTask>(`/coach/programme/tasks/${taskId}?today=${today()}`, json("PATCH", task)),
  deleteDraft: (taskId: string) => request<void>(`/coach/programme/tasks/${taskId}`, { method: "DELETE" }),
  setState: (taskId: string, action: "pause" | "resume" | "stop", reason: string) =>
    request<ProgrammeTask>(`/coach/programme/tasks/${taskId}/state?today=${today()}`, json("POST", { action, reason })),
  publish: (id: string, reason: string) => request<{ version: number }>(`/coach/programme/enrolments/${id}/publish`, json("POST", { reason })),
  reply: (taskId: string, date: string, note: string) => request<DayState>(`/coach/programme/tasks/${taskId}/reply`, json("POST", { date, note })),
  review: (id: string, kind: "WEEKLY" | "FINAL", notes: string, nextReviewOn: string | null) =>
    request(`/coach/programme/enrolments/${id}/reviews`, json("POST", { kind, notes, nextReviewOn })),
};

/** The administrator's side. */
export const adminProgrammeService = {
  programmes: () => request<AdminProgramme[]>("/admin/programme/programmes"),
  createProgramme: (p: { name: string; summary: string; durationDays: number }) => request<AdminProgramme>("/admin/programme/programmes", json("POST", p)),
  updateProgramme: (id: string, p: Partial<{ name: string; summary: string; durationDays: number; status: AdminProgramme["status"] }>) =>
    request<AdminProgramme>(`/admin/programme/programmes/${id}`, json("PATCH", p)),
  templates: () => request<TaskTemplate[]>("/admin/programme/templates"),
  createTemplate: (t: Omit<TaskTemplate, "id" | "status" | "reviewedBy" | "reviewedAt">) => request<TaskTemplate>("/admin/programme/templates", json("POST", t)),
  updateTemplate: (id: string, t: Partial<Omit<TaskTemplate, "id" | "reviewedBy" | "reviewedAt">>) => request<TaskTemplate>(`/admin/programme/templates/${id}`, json("PATCH", t)),
  approveTemplate: (id: string, reviewedBy: string) => request<TaskTemplate>(`/admin/programme/templates/${id}/approve`, json("POST", { reviewedBy })),
  enrolments: () => request<AdminEnrolment[]>("/admin/programme/enrolments"),
  coaches: () => request<{ id: string; name: string; caseload: number }[]>("/admin/programme/coaches"),
  assignCoach: (enrolmentId: string, coachId: string) => request(`/admin/programme/enrolments/${enrolmentId}/coach`, json("PUT", { coachId })),
};
