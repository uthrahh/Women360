import { request } from "./apiClient";
import type { CoachedWoman, CoachNote, CoachSummary, NoteFromCoach, SharedCoach } from "@/types";

export const coachService = {
  // The woman's side: who may see her information.
  listSharing: () => request<SharedCoach[]>("/coach/sharing"),
  grant: (coachEmail: string) => request("/coach/sharing", { method: "POST", body: JSON.stringify({ coachEmail }) }),
  revoke: (coachId: string) => request("/coach/sharing", { method: "DELETE", body: JSON.stringify({ coachId }) }),
  notesForMe: () => request<NoteFromCoach[]>("/coach/sharing/notes"),

  // The coach's side: only women who chose to share.
  assignedWomen: () => request<CoachedWoman[]>("/coach/assigned-women"),
  summary: (womanId: string) => request<CoachSummary>(`/coach/women/${womanId}/summary`),
  notes: (womanId: string) => request<CoachNote[]>(`/coach/women/${womanId}/notes`),
  addNote: (womanId: string, note: string, visibleToWoman: boolean) =>
    request<CoachNote>(`/coach/women/${womanId}/notes`, { method: "POST", body: JSON.stringify({ note, visibleToWoman }) }),
};
