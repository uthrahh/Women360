import { request } from "./apiClient";
import type { InsightsSummary } from "@/types";

export const insightsService = {
  async getSummary(): Promise<InsightsSummary> {
    return request<InsightsSummary>("/insights");
  },
};
