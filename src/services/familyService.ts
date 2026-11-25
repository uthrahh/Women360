import { request } from "./apiClient";
import type { FamilyLevel, FamilyOverview, OpenedPerson, ProfileInput } from "@/types/family";

const json = (method: string, body: unknown) => ({ method, body: JSON.stringify(body) });

export const familyService = {
  overview: () => request<FamilyOverview>("/family"),
  open: (id: string) => request<OpenedPerson>(`/family/open/${id}`, { method: "POST" }),
  createProfile: (p: ProfileInput) => request<{ id: string; name: string }>("/family/profiles", json("POST", p)),
  updateProfile: (id: string, p: Partial<ProfileInput>) => request(`/family/profiles/${id}`, json("PATCH", p)),
  deleteProfile: (id: string) => request<void>(`/family/profiles/${id}`, { method: "DELETE" }),
  exportProfile: (id: string) => request<unknown>(`/family/profiles/${id}/export`),
  share: (email: string, level: FamilyLevel) => request<{ accessId: string }>("/family/share", json("POST", { email, level })),
  ask: (email: string) => request<{ accessId: string }>("/family/request", json("POST", { email })),
  setLevel: (accessId: string, level: FamilyLevel) => request(`/family/access/${accessId}`, json("PUT", { level })),
  end: (accessId: string) => request(`/family/access/${accessId}`, { method: "DELETE" }),
};
