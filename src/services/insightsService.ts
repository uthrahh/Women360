import { request } from "./apiClient";
import type { DailyPoint, FactorReport, InsightsSummary } from "@/types";
import { localDateISO } from "./mappers";

export const insightsService = {
  /** Her logs side by side, one row per day (null where nothing was logged). */
  async daily(days: 30 | 90): Promise<DailyPoint[]> {
    return request<DailyPoint[]>(`/insights/daily?days=${days}&today=${localDateISO()}`);
  },
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
