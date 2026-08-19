import { delay } from "./apiClient";
import { mockCycle } from "@/mock/seed";
import type { CycleSummary, CycleDay } from "@/types";

export const cycleService = {
  async getSummary(): Promise<CycleSummary> {
    return delay(mockCycle);
  },
  async logDay(entry: Partial<CycleDay> & { date: string }): Promise<CycleDay> {
    return delay(entry as CycleDay, 350);
  },
};
