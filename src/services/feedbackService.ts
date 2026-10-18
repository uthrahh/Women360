import { request } from "./apiClient";

export const feedbackService = {
  async submit(input: { rating: number; message?: string }): Promise<void> {
    await request("/feedback", { method: "POST", body: JSON.stringify(input) });
  },
};
