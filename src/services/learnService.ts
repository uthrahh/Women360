import { request } from "./apiClient";
import type { LearnArticle } from "@/types";

export const learnService = {
  async list(): Promise<LearnArticle[]> {
    return request<LearnArticle[]>("/learn");
  },
};
