import { request } from "./apiClient";
import type { HealthReportDetail } from "@/types";
import { toFrontendReportRecord } from "./mappers";

export const reportService = {
  async list() {
    const apiReports = await request<Parameters<typeof toFrontendReportRecord>[0][]>("/reports");
    return apiReports.map(toFrontendReportRecord);
  },
  async generate(title: string, rangeLabel: string, rangeDays: number) {
    const apiReport = await request<Parameters<typeof toFrontendReportRecord>[0]>("/reports", {
      method: "POST",
      body: JSON.stringify({ title, rangeLabel, rangeDays }),
    });
    return toFrontendReportRecord(apiReport);
  },
  // Full detail, including the data snapshot the summary list doesn't return.
  async getById(id: string): Promise<HealthReportDetail> {
    return request(`/reports/${id}`);
  },
};
