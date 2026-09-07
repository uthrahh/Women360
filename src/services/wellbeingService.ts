import { request } from "./apiClient";
import type { WellbeingEntry } from "@/types";
import { toBackendWellbeingEntry, toFrontendWellbeingEntry } from "./mappers";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export const wellbeingService = {
  // The backend returns the last 14 days; the UI expects roughly a week.
  async getWeek(): Promise<WellbeingEntry[]> {
    const apiEntries = await request<Parameters<typeof toFrontendWellbeingEntry>[0][]>("/wellbeing/entries");
    return apiEntries.map(toFrontendWellbeingEntry).slice(-7);
  },
  async logToday(entry: Omit<WellbeingEntry, "date">): Promise<WellbeingEntry> {
    const apiEntry = await request<Parameters<typeof toFrontendWellbeingEntry>[0]>(`/wellbeing/entries/${todayISO()}`, {
      method: "PUT",
      body: JSON.stringify(toBackendWellbeingEntry(entry)),
    });
    // WellbeingPage dedupes today's entry by checking date === "Today" —
    // preserve that exact contract rather than a weekday label here.
    return { ...toFrontendWellbeingEntry(apiEntry), date: "Today" };
  },
};
