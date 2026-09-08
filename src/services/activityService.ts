import { request } from "./apiClient";
import type { ActivitySummary, ActivityEntry } from "@/types";
import { localDateISO, toBackendActivityEntry, toFrontendActivityEntry, toFrontendActivitySummary } from "./mappers";

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
      body: JSON.stringify(toBackendActivityEntry(entry, localDateISO())),
    });
    return toFrontendActivityEntry(apiEntry);
  },
  async deleteEntry(id: string): Promise<void> {
    await request(`/activity/entries/${id}`, { method: "DELETE" });
  },
};
