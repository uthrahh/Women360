import { request } from "./apiClient";
import type { ActivityCatalog, ActivityEntry, ActivitySummary, Effort, QuickLogItem } from "@/types";
import { localDateISO, toFrontendActivityEntry, toFrontendActivitySummary } from "./mappers";

type ApiEntry = Parameters<typeof toFrontendActivityEntry>[0];
type ApiQuickLog = { id: string; label: string; type: string; activityCode: string; durationMinutes: number; intensity: string; caloriesBurned: number | null };

const toQuickLog = (q: ApiQuickLog): QuickLogItem => ({
  id: q.id,
  label: q.label,
  type: q.type,
  activityCode: q.activityCode,
  duration: q.durationMinutes,
  intensity: q.intensity.toLowerCase() as Effort,
  caloriesBurned: q.caloriesBurned,
});

export interface ActivityInput {
  activityCode: string;
  duration: number;
  intensity: Effort;
  distanceKm?: number | null;
  sets?: number | null;
  notes?: string;
  /** YYYY-MM-DD; today when left out. */
  day?: string;
}

const body = (input: ActivityInput) => ({
  activityCode: input.activityCode,
  durationMinutes: input.duration,
  intensity: input.intensity.toUpperCase(),
  distanceKm: input.distanceKm ?? null,
  sets: input.sets ?? null,
});

export const activityService = {
  catalog: () => request<ActivityCatalog>("/activity/catalog"),

  async getSummary(): Promise<ActivitySummary> {
    const apiSummary = await request<Parameters<typeof toFrontendActivitySummary>[0]>("/activity/summary");
    return toFrontendActivitySummary(apiSummary);
  },
  async logActivity(input: ActivityInput): Promise<ActivityEntry> {
    const apiEntry = await request<ApiEntry>("/activity/entries", {
      method: "POST",
      body: JSON.stringify({ ...body(input), date: input.day ?? localDateISO(), notes: input.notes || undefined }),
    });
    return toFrontendActivityEntry(apiEntry);
  },
  async updateEntry(id: string, input: ActivityInput): Promise<ActivityEntry> {
    const apiEntry = await request<ApiEntry>(`/activity/entries/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ ...body(input), notes: input.notes ?? "", ...(input.day ? { date: input.day } : {}) }),
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
  async addQuickLog(item: { activityCode: string; duration: number; intensity: Effort }): Promise<QuickLogItem> {
    return toQuickLog(
      await request<ApiQuickLog>("/activity/quick-log", {
        method: "POST",
        body: JSON.stringify({ activityCode: item.activityCode, durationMinutes: item.duration, intensity: item.intensity.toUpperCase() }),
      })
    );
  },
  async removeQuickLog(id: string): Promise<void> {
    await request(`/activity/quick-log/${id}`, { method: "DELETE" });
  },
};
