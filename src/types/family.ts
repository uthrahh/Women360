export type FamilyLevel = "MONITOR" | "MODIFY";

export interface FamilyPerson {
  id: string;
  name: string;
  email?: string;
  avatarInitials?: string | null;
  cycleTracking?: boolean;
}

export interface FamilyOverview {
  managed: { id: string; name: string; relation: string | null; dateOfBirth: string | null; cycleTracking: boolean; avatarInitials: string | null }[];
  sharedWithMe: { accessId: string; level: FamilyLevel; person: FamilyPerson }[];
  myRequests: { accessId: string; person: { name: string; email: string } }[];
  sharingWith: { accessId: string; level: FamilyLevel; person: FamilyPerson }[];
  requestsToMe: { accessId: string; person: { name: string; email: string } }[];
}

export interface OpenedPerson {
  id: string;
  name: string;
  access: "MANAGE" | "MODIFY" | "MONITOR";
  cycleTracking: boolean;
  minor: boolean;
}

export interface ProfileInput {
  name: string;
  dateOfBirth: string;
  relation?: string | null;
  cycleTracking: boolean;
  guardianConfirmed?: boolean;
}

export const LEVEL_LABEL: Record<FamilyLevel, string> = { MONITOR: "Can view", MODIFY: "Can view and update" };
