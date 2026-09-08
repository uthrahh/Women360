import { request } from "./apiClient";
import type { User } from "@/types";
import { toFrontendUser } from "./mappers";

export interface EmergencyContact {
  name: string;
  phone: string;
  relationship?: string;
}

export const userService = {
  async updateProfile(patch: { name?: string; dateOfBirth?: string }): Promise<User> {
    const apiUser = await request<Parameters<typeof toFrontendUser>[0]>("/users/me", {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    return toFrontendUser(apiUser);
  },
  async getEmergencyContact(): Promise<EmergencyContact | null> {
    return request<EmergencyContact | null>("/users/me/emergency-contact");
  },
  async updateEmergencyContact(contact: EmergencyContact): Promise<EmergencyContact> {
    return request<EmergencyContact>("/users/me/emergency-contact", {
      method: "PUT",
      body: JSON.stringify(contact),
    });
  },
};
