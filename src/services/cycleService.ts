import { request } from "./apiClient";
import type { CycleSummary, CycleDay, CycleProfileSettings, CyclePhaseCalendar } from "@/types";
import { localDateISO, toBackendCycleEntry, toFrontendCycleDay, toFrontendCycleSummary } from "./mappers";

export const cycleService = {
  async getSummary(): Promise<CycleSummary> {
    // Sends the browser's own local calendar date so "current cycle day"
    // can't undercount for a user meaningfully ahead of UTC.
    const apiSummary = await request<Parameters<typeof toFrontendCycleSummary>[0]>(
      `/cycle/summary?today=${localDateISO()}`
    );
    return toFrontendCycleSummary(apiSummary);
  },
  async logDay(entry: Partial<CycleDay> & { date: string }): Promise<CycleDay> {
    const apiEntry = await request<Parameters<typeof toFrontendCycleDay>[0]>(`/cycle/entries/${entry.date}`, {
      method: "PUT",
      body: JSON.stringify(toBackendCycleEntry(entry)),
    });
    return toFrontendCycleDay(apiEntry);
  },
  async deleteEntry(date: string): Promise<void> {
    await request(`/cycle/entries/${date}`, { method: "DELETE" });
  },
  async listEntries(from: string, to: string): Promise<CycleDay[]> {
    const apiEntries = await request<Parameters<typeof toFrontendCycleDay>[0][]>(
      `/cycle/entries?from=${from}&to=${to}`
    );
    return apiEntries.map(toFrontendCycleDay);
  },
  async getPhaseCalendar(from: string, to: string): Promise<CyclePhaseCalendar> {
    return request<CyclePhaseCalendar>(
      `/cycle/phase-calendar?from=${from}&to=${to}&today=${localDateISO()}`
    );
  },
  async getProfile(): Promise<CycleProfileSettings> {
    return request<CycleProfileSettings>("/cycle/profile");
  },
  async upsertProfile(profile: CycleProfileSettings): Promise<CycleProfileSettings> {
    return request<CycleProfileSettings>("/cycle/profile", {
      method: "PUT",
      body: JSON.stringify(profile),
    });
  },
};
