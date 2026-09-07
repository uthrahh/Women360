import { request } from "./apiClient";
import type { VitalMeasurement } from "@/types";
import { toBackendVitalType, toFrontendAppointment, toFrontendMedication, toFrontendVital } from "./mappers";

export const healthService = {
  async getAppointments() {
    const apiAppointments = await request<Parameters<typeof toFrontendAppointment>[0][]>("/health/appointments");
    return apiAppointments.map(toFrontendAppointment);
  },
  async getMedications() {
    const apiMedications = await request<Parameters<typeof toFrontendMedication>[0][]>("/health/medications");
    return apiMedications.map(toFrontendMedication);
  },
  async getVitals() {
    const apiVitals = await request<Parameters<typeof toFrontendVital>[0][]>("/health/vitals");
    return apiVitals.map(toFrontendVital);
  },
  async addVital(entry: Omit<VitalMeasurement, "id">): Promise<VitalMeasurement> {
    const apiVital = await request<Parameters<typeof toFrontendVital>[0]>("/health/vitals", {
      method: "POST",
      body: JSON.stringify({ ...entry, type: toBackendVitalType(entry.type) }),
    });
    return toFrontendVital(apiVital);
  },
};
