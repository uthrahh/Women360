import { request } from "./apiClient";
import type { Appointment, Medication, VitalMeasurement } from "@/types";
import {
  toBackendAppointment,
  toBackendVitalType,
  toFrontendAppointment,
  toFrontendMedication,
  toFrontendVital,
  upper,
} from "./mappers";

export const healthService = {
  async getAppointments() {
    const apiAppointments = await request<Parameters<typeof toFrontendAppointment>[0][]>("/health/appointments");
    return apiAppointments.map(toFrontendAppointment);
  },
  async addAppointment(appointment: Omit<Appointment, "id">): Promise<Appointment> {
    const apiAppointment = await request<Parameters<typeof toFrontendAppointment>[0]>("/health/appointments", {
      method: "POST",
      body: JSON.stringify(toBackendAppointment(appointment)),
    });
    return toFrontendAppointment(apiAppointment);
  },
  async updateAppointment(id: string, patch: Partial<Omit<Appointment, "id">>): Promise<Appointment> {
    const apiAppointment = await request<Parameters<typeof toFrontendAppointment>[0]>(`/health/appointments/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ ...patch, kind: patch.kind ? upper(patch.kind) : undefined }),
    });
    return toFrontendAppointment(apiAppointment);
  },
  async deleteAppointment(id: string): Promise<void> {
    await request(`/health/appointments/${id}`, { method: "DELETE" });
  },

  async getMedications() {
    const apiMedications = await request<Parameters<typeof toFrontendMedication>[0][]>("/health/medications");
    return apiMedications.map(toFrontendMedication);
  },
  async addMedication(medication: Omit<Medication, "id">): Promise<Medication> {
    const apiMedication = await request<Parameters<typeof toFrontendMedication>[0]>("/health/medications", {
      method: "POST",
      body: JSON.stringify(medication),
    });
    return toFrontendMedication(apiMedication);
  },
  async updateMedication(id: string, patch: Partial<Omit<Medication, "id">>): Promise<Medication> {
    const apiMedication = await request<Parameters<typeof toFrontendMedication>[0]>(`/health/medications/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    return toFrontendMedication(apiMedication);
  },
  async deleteMedication(id: string): Promise<void> {
    await request(`/health/medications/${id}`, { method: "DELETE" });
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
