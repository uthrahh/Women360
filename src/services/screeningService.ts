import { request } from "./apiClient";
import { localDateISO } from "./mappers";
import type { ScreeningPlan } from "@/types";

// "Due" is worked out against the person's own calendar day, not server time.
const today = () => `today=${localDateISO()}`;

export const screeningService = {
  list: () => request<ScreeningPlan>(`/screening?${today()}`),
  /** "I had this done on <day>". Returns the refreshed plan so one tap updates everything. */
  record: (id: string, doneOn: string) =>
    request<ScreeningPlan>(`/screening/${id}/records?${today()}`, { method: "POST", body: JSON.stringify({ doneOn }) }),
  async undo(id: string, recordId: string): Promise<ScreeningPlan> {
    await request(`/screening/${id}/records/${recordId}`, { method: "DELETE" });
    return request<ScreeningPlan>(`/screening?${today()}`);
  },
};
