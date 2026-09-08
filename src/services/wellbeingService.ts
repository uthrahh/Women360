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
  // getWeek() maps every date to a weekday label for the chart, which loses
  // which entry is actually today's — fetch the raw list again and find it
  // by the real date instead of guessing from the (possibly empty) week.
  async getTodayMood(): Promise<WellbeingEntry | null> {
    const apiEntries = await request<Parameters<typeof toFrontendWellbeingEntry>[0][]>("/wellbeing/entries");
    const todayEntry = apiEntries.find((e) => e.date.slice(0, 10) === todayISO());
    return todayEntry ? { ...toFrontendWellbeingEntry(todayEntry), date: "Today" } : null;
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
