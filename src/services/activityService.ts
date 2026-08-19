import { delay } from "./apiClient";
import { mockActivity } from "@/mock/seed";
import type { ActivitySummary, ActivityEntry } from "@/types";

export const activityService = {
  async getSummary(): Promise<ActivitySummary> {
    return delay(mockActivity);
  },
  async logActivity(entry: Omit<ActivityEntry, "id">): Promise<ActivityEntry> {
    return delay({ ...entry, id: `a_${Date.now()}` }, 350);
  },
};
