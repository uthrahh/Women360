import { request } from "./apiClient";
import { toFrontendMessage } from "./mappers";

export const messageService = {
  async list() {
    const apiMessages = await request<Parameters<typeof toFrontendMessage>[0][]>("/messages");
    return apiMessages.map(toFrontendMessage);
  },
};
