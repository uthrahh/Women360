import { request } from "./apiClient";
import { localDateISO } from "./mappers";
import type { ConditionCode, ConditionList, HealthSignals } from "@/types";

export const conditionService = {
  list: () => request<ConditionList>("/conditions"),
  setDeclared: (conditions: ConditionCode[]) => request<ConditionList>("/conditions", { method: "PUT", body: JSON.stringify({ conditions }) }),
  signals: () => request<HealthSignals>(`/conditions/signals?today=${localDateISO()}`),
  async dismiss(key: string): Promise<void> {
    await request(`/conditions/signals/${key}/dismiss`, { method: "POST" });
  },
};
