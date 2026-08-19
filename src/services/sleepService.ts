import { delay } from "./apiClient";
import { mockSleep } from "@/mock/seed";
import type { SleepSummary } from "@/types";

export const sleepService = {
  async getSummary(): Promise<SleepSummary> {
    return delay(mockSleep);
  },
};
