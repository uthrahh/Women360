import { request } from "./apiClient";
import type { BodyKind, BodyLogEntry, BowelDetail } from "@/types";

/** Caffeine, alcohol and bowel movements, on her own calendar day. */
export const bodyService = {
  list: (date: string) => request<BodyLogEntry[]>(`/body?date=${date}`),
  log: (date: string, kind: BodyKind, detail?: BowelDetail) =>
    request<BodyLogEntry>("/body", { method: "POST", body: JSON.stringify({ date, kind, ...(detail ? { detail } : {}) }) }),
  remove: (id: string) => request(`/body/${id}`, { method: "DELETE" }),
};
