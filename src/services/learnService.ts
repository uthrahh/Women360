import { delay } from "./apiClient";
import { mockLearn } from "@/mock/seed";

export const learnService = {
  async list() {
    return delay(mockLearn);
  },
};
