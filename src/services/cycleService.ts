import { request } from "./apiClient";
import type { CycleSummary, CycleDay } from "@/types";
import { toBackendCycleEntry, toFrontendCycleDay, toFrontendCycleSummary } from "./mappers";

export const cycleService = {
  async getSummary(): Promise<CycleSummary> {
    const apiSummary = await request<Parameters<typeof toFrontendCycleSummary>[0]>("/cycle/summary");
    return toFrontendCycleSummary(apiSummary);
  },
  async logDay(entry: Partial<CycleDay> & { date: string }): Promise<CycleDay> {
    const apiEntry = await request<Parameters<typeof toFrontendCycleDay>[0]>(`/cycle/entries/${entry.date}`, {
      method: "PUT",
      body: JSON.stringify(toBackendCycleEntry(entry)),
    });
    return toFrontendCycleDay(apiEntry);
  },
  async deleteEntry(date: string): Promise<void> {
    await request(`/cycle/entries/${date}`, { method: "DELETE" });
  },
};
