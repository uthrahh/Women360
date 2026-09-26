import { request } from "./apiClient";
import type { FactorReport, InsightsSummary } from "@/types";

export const insightsService = {
  async getSummary(): Promise<InsightsSummary> {
    return request<InsightsSummary>("/insights");
  },
  async explainCycleDelay(): Promise<FactorReport> {
    return request<FactorReport>("/insights/cycle-delay");
  },
  async explainLowMood(): Promise<FactorReport> {
    return request<FactorReport>("/insights/low-mood");
  },
};
