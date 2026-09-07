import { request } from "./apiClient";
import type { AppNotification } from "@/types";
import { toFrontendNotification } from "./mappers";

export const notificationService = {
  async list(): Promise<AppNotification[]> {
    const apiNotifications = await request<Parameters<typeof toFrontendNotification>[0][]>("/notifications");
    return apiNotifications.map(toFrontendNotification);
  },
};
