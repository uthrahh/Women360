import { request } from "./apiClient";
import type { Answers, Basic, ClientListItem, ClientRecord, IntakeForm, IntakeSection, Measurement, NewClientInput, Speciality } from "@/types/clients";

const json = (method: string, body: unknown) => ({ method, body: JSON.stringify(body) });

/** The coach's side: /coach/clients. */
export const clientService = {
  form: () => request<IntakeForm & { specialities: { code: Speciality; label: string }[] }>("/coach/clients/form"),
  list: () => request<ClientListItem[]>("/coach/clients"),
  directory: () => request<{ id: string; name: string; specialities: Speciality[] }[]>("/coach/clients/directory"),
  create: (input: NewClientInput) => request<{ id: string }>("/coach/clients", json("POST", input)),
  record: (id: string) => request<ClientRecord>(`/coach/clients/${id}`),
  updateBasic: (id: string, patch: Partial<Omit<Basic, "age">> & { guardianConsent?: boolean }) => request(`/coach/clients/${id}`, json("PATCH", patch)),
  remove: (id: string) => request<void>(`/coach/clients/${id}`, { method: "DELETE" }),
  saveSection: (id: string, section: IntakeSection, answers: Answers) => request<{ answers: Answers }>(`/coach/clients/${id}/intake/${section}`, json("PUT", { answers })),
  addMeasurement: (id: string, m: Partial<Omit<Measurement, "id" | "bmi" | "waistHipRatio">> & { date: string }) => request<Measurement>(`/coach/clients/${id}/measurements`, json("POST", m)),
  deleteMeasurement: (id: string, mid: string) => request<void>(`/coach/clients/${id}/measurements/${mid}`, { method: "DELETE" }),
  addConsultation: (id: string, c: { area: Speciality; date: string; targetWeightKg?: number | null; targetDate?: string | null; planGiven?: string | null; nextFollowUp?: string | null; notes?: string | null }) =>
    request<{ id: string }>(`/coach/clients/${id}/consultations`, json("POST", c)),
  deleteConsultation: (cid: string) => request(`/coach/clients/consultations/${cid}`, { method: "DELETE" }),
  addCoach: (id: string, coachId: string) => request(`/coach/clients/${id}/coaches`, json("POST", { coachId })),
  leave: (id: string) => request(`/coach/clients/${id}/leave`, { method: "POST" }),
  invite: (id: string) => request<{ link: string; expiresInDays: number }>(`/coach/clients/${id}/invite`, { method: "POST" }),
};

/** The client's side: her coaches and what they recorded. */
export const myCoachingService = {
  overview: () =>
    request<{
      coaches: { id: string; name: string; specialities: Speciality[] }[];
      profile: Record<string, string | null> | null;
      intake: Partial<Record<IntakeSection, Answers | null>> | null;
      measurements: Measurement[];
      plans: { id: string; area: Speciality; date: string; coach: string | null; planGiven: string | null; targetWeightKg: number | null; targetDate: string | null; nextFollowUp: string | null }[];
    }>("/coaching"),
  removeCoach: (coachId: string) => request(`/coaching/coaches/${coachId}`, { method: "DELETE" }),
};

/** Administrators: coaches and their specialities. */
export const adminCoachService = {
  list: () => request<{ id: string; name: string; email: string; specialities: Speciality[]; clients: number; pending: boolean }[]>("/admin/coaches"),
  create: (input: { name: string; email: string; specialities: Speciality[] }) => request<{ id: string; link: string; expiresInDays: number }>("/admin/coaches", json("POST", input)),
  setSpecialities: (id: string, specialities: Speciality[]) => request(`/admin/coaches/${id}/specialities`, json("PUT", { specialities })),
  newLink: (id: string) => request<{ link: string; expiresInDays: number }>(`/admin/coaches/${id}/link`, { method: "POST" }),
};
