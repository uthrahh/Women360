import { delay } from "./apiClient";
import { mockAppointments, mockMedications, mockVitals } from "@/mock/seed";
import type { VitalMeasurement } from "@/types";

export const healthService = {
  async getAppointments() {
    return delay(mockAppointments);
  },
  async getMedications() {
    return delay(mockMedications);
  },
  async getVitals() {
    return delay(mockVitals);
  },
  async addVital(entry: Omit<VitalMeasurement, "id">): Promise<VitalMeasurement> {
    return delay({ ...entry, id: `v_${Date.now()}` }, 350);
  },
};
