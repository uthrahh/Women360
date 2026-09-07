import { request } from "./apiClient";
import type { SleepSummary } from "@/types";

export const sleepService = {
  async getSummary(): Promise<SleepSummary> {
    return request<SleepSummary>("/sleep/summary");
  },
};
