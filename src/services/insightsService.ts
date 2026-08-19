import { delay } from "./apiClient";
import { mockInsights } from "@/mock/seed";

export const insightsService = {
  async getSummary() {
    return delay(mockInsights);
  },
};
