import { request } from "./apiClient";
import { rangeLabelToDays, toFrontendReportRecord } from "./mappers";

export const reportService = {
  async list() {
    const apiReports = await request<Parameters<typeof toFrontendReportRecord>[0][]>("/reports");
    return apiReports.map(toFrontendReportRecord);
  },
  async generate(title: string, range: string) {
    const apiReport = await request<Parameters<typeof toFrontendReportRecord>[0]>("/reports", {
      method: "POST",
      body: JSON.stringify({ title, rangeLabel: range, rangeDays: rangeLabelToDays(range) }),
    });
    return toFrontendReportRecord(apiReport);
  },
  // Full detail, including the data snapshot the summary list doesn't return.
  async getById(id: string): Promise<{ title: string; rangeLabel: string; generatedOn: string; dataSnapshot: unknown }> {
    return request(`/reports/${id}`);
  },
};
