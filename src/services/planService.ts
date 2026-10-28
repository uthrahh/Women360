import { request } from "./apiClient";
import { localDateISO } from "./mappers";
import type { ActivePlan, ActivityPlan, PlanOptions, PlanRequest } from "@/types";

export const planService = {
  options: () => request<PlanOptions>(`/activity/plan/options?today=${localDateISO()}`),
  preview: (req: PlanRequest) => request<ActivityPlan>("/activity/plan/preview", { method: "POST", body: JSON.stringify(req) }),
  start: (req: PlanRequest) => request<ActivePlan>("/activity/plan", { method: "POST", body: JSON.stringify(req) }),
  active: () => request<ActivePlan | null>(`/activity/plan/active?today=${localDateISO()}`),
  async end(id: string): Promise<void> {
    await request(`/activity/plan/${id}/end`, { method: "POST" });
  },
};
