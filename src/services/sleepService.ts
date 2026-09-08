import { request } from "./apiClient";
import type { SleepEntry, SleepSummary } from "@/types";
import { toBackendSleepEntry, toFrontendSleepEntry, toFrontendSleepSummary } from "./mappers";

export const sleepService = {
  async getSummary(): Promise<SleepSummary> {
    const apiSummary = await request<Parameters<typeof toFrontendSleepSummary>[0]>("/sleep/summary");
    return toFrontendSleepSummary(apiSummary);
  },
  async logEntry(date: string, entry: { bedtime24: string; wake24: string; quality: number; notes?: string }): Promise<SleepEntry> {
    const apiEntry = await request<Parameters<typeof toFrontendSleepEntry>[0]>(`/sleep/entries/${date}`, {
      method: "PUT",
      body: JSON.stringify(toBackendSleepEntry(entry)),
    });
    return toFrontendSleepEntry(apiEntry);
  },
  async deleteEntry(date: string): Promise<void> {
    await request(`/sleep/entries/${date}`, { method: "DELETE" });
  },
};
