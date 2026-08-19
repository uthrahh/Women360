import { delay } from "./apiClient";
import { mockWellbeing } from "@/mock/seed";
import type { WellbeingEntry } from "@/types";

export const wellbeingService = {
  async getWeek(): Promise<WellbeingEntry[]> {
    return delay(mockWellbeing);
  },
  async logToday(entry: Omit<WellbeingEntry, "date">): Promise<WellbeingEntry> {
    return delay({ ...entry, date: "Today" }, 300);
  },
};
