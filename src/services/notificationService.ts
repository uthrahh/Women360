import { delay } from "./apiClient";
import { mockNotifications, type AppNotification } from "@/mock/seed";

export const notificationService = {
  async list(): Promise<AppNotification[]> {
    return delay(mockNotifications);
  },
};
