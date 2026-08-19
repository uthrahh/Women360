import { delay } from "./apiClient";
import { mockMessages } from "@/mock/seed";

export const messageService = {
  async list() {
    return delay(mockMessages);
  },
};
