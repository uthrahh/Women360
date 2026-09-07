import { request } from "./apiClient";
import type { ActivitySummary, ActivityEntry } from "@/types";
import { toBackendActivityEntry, toFrontendActivityEntry, toFrontendActivitySummary } from "./mappers";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export const activityService = {
  async getSummary(): Promise<ActivitySummary> {
    const apiSummary = await request<Parameters<typeof toFrontendActivitySummary>[0]>("/activity/summary");
    return toFrontendActivitySummary(apiSummary);
  },
  // `entry.date` from the UI is currently always the placeholder "Today" —
  // the backend needs a real date, so today's date is used instead.
  async logActivity(entry: Omit<ActivityEntry, "id">): Promise<ActivityEntry> {
    const apiEntry = await request<Parameters<typeof toFrontendActivityEntry>[0]>("/activity/entries", {
      method: "POST",
      body: JSON.stringify(toBackendActivityEntry(entry, todayISO())),
    });
    return toFrontendActivityEntry(apiEntry);
  },
};
