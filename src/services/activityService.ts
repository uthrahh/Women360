import { request } from "./apiClient";
import type { ActivitySummary, ActivityEntry, QuickLogItem } from "@/types";
import { localDateISO, toFrontendActivityEntry, toFrontendActivitySummary } from "./mappers";

type ApiEntry = Parameters<typeof toFrontendActivityEntry>[0];
type ApiQuickLog = { id: string; label: string; type: string; durationMinutes: number; intensity: string };

const toQuickLog = (q: ApiQuickLog): QuickLogItem => ({
  id: q.id,
  label: q.label,
  type: q.type,
  duration: q.durationMinutes,
  intensity: q.intensity.toLowerCase() as QuickLogItem["intensity"],
});

export interface ActivityInput {
  type: string;
  duration: number;
  intensity: ActivityEntry["intensity"];
  notes?: string;
  /** YYYY-MM-DD; today when left out. */
  day?: string;
}

export const activityService = {
  async getSummary(): Promise<ActivitySummary> {
    const apiSummary = await request<Parameters<typeof toFrontendActivitySummary>[0]>("/activity/summary");
    return toFrontendActivitySummary(apiSummary);
  },
  async logActivity(input: ActivityInput): Promise<ActivityEntry> {
    const apiEntry = await request<ApiEntry>("/activity/entries", {
      method: "POST",
      body: JSON.stringify({
        date: input.day ?? localDateISO(),
        type: input.type,
        durationMinutes: input.duration,
        intensity: input.intensity.toUpperCase(),
        notes: input.notes || undefined,
      }),
    });
    return toFrontendActivityEntry(apiEntry);
  },
  async updateEntry(id: string, input: ActivityInput): Promise<ActivityEntry> {
    const apiEntry = await request<ApiEntry>(`/activity/entries/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        type: input.type,
        durationMinutes: input.duration,
        intensity: input.intensity.toUpperCase(),
        notes: input.notes ?? "",
        ...(input.day ? { date: input.day } : {}),
      }),
    });
    return toFrontendActivityEntry(apiEntry);
  },
  /** Sets today's step count (entered by hand until a device is connected). */
  async logSteps(steps: number): Promise<void> {
    await request("/activity/steps", { method: "POST", body: JSON.stringify({ date: localDateISO(), steps }) });
  },
  async deleteEntry(id: string): Promise<void> {
    await request(`/activity/entries/${id}`, { method: "DELETE" });
  },
  async listQuickLog(): Promise<QuickLogItem[]> {
    return (await request<ApiQuickLog[]>("/activity/quick-log")).map(toQuickLog);
  },
  async addQuickLog(item: Omit<QuickLogItem, "id">): Promise<QuickLogItem> {
    return toQuickLog(
      await request<ApiQuickLog>("/activity/quick-log", {
        method: "POST",
        body: JSON.stringify({ label: item.label, type: item.type, durationMinutes: item.duration, intensity: item.intensity.toUpperCase() }),
      })
    );
  },
  async removeQuickLog(id: string): Promise<void> {
    await request(`/activity/quick-log/${id}`, { method: "DELETE" });
  },
};
