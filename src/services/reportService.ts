import { delay } from "./apiClient";
import { mockReports } from "@/mock/seed";

export const reportService = {
  async list() {
    return delay(mockReports);
  },
  async generate(title: string, range: string) {
    return delay({ id: `r_${Date.now()}`, title, range, generatedOn: new Date().toISOString().slice(0, 10) }, 900);
  },
};
