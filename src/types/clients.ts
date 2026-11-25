export type Speciality = "GENERAL" | "NUTRITION" | "FITNESS" | "WELLBEING" | "WOMENS_HEALTH";
export type Section = "measurements" | "lifestyle" | "medical" | "menstrual" | "dietary";
export type IntakeSection = "lifestyle" | "medical" | "menstrual" | "dietary";

export const SPECIALITY_LABEL: Record<Speciality, string> = {
  GENERAL: "General wellness",
  NUTRITION: "Nutrition",
  FITNESS: "Fitness and physiotherapy",
  WELLBEING: "Mental wellbeing",
  WOMENS_HEALTH: "Women's health",
};
export const SPECIALITY_CODES = Object.keys(SPECIALITY_LABEL) as Speciality[];

type FBase = { id: string; label: string };
export type IntakeField =
  | (FBase & { type: "choice"; options: string[]; showIf?: { field: string; equals: string } })
  | (FBase & { type: "number"; min: number; max: number; step: number; unit?: string })
  | (FBase & { type: "text"; maxLength: number; long?: boolean })
  | (FBase & { type: "date" })
  | (FBase & { type: "recall" });
export type RecallRow = { time: string; food: string };
export type Answers = Record<string, string | number | RecallRow[]>;

export interface IntakeForm {
  version: number;
  sections: Record<IntakeSection, { title: string; fields: IntakeField[] }>;
}

export interface ClientListItem {
  id: string;
  name: string;
  age: number | null;
  gender: string | null;
  lastSeen: string | null;
  nextFollowUp: string | null;
  usesApp: boolean;
}

export interface Measurement {
  id: string;
  date: string;
  heightCm: number | null;
  weightKg: number | null;
  waistCm: number | null;
  hipCm: number | null;
  chestCm: number | null;
  armCm: number | null;
  thighCm: number | null;
  bmi: number | null;
  waistHipRatio: number | null;
}

export interface ConsultationItem {
  id: string;
  area: Speciality;
  date: string;
  targetWeightKg: number | null;
  targetDate: string | null;
  planGiven: string | null;
  nextFollowUp: string | null;
  notes: string | null;
  coach: { name: string } | null;
  mine: boolean;
}

export interface Basic {
  name: string;
  dateOfBirth: string | null;
  age: number | null;
  gender: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  occupation: string | null;
  maritalStatus: string | null;
  tracksCycle: boolean;
}

export interface ClientRecord {
  id: string;
  basic: Basic;
  mySpecialities: Speciality[];
  sections: Section[];
  measurements?: Measurement[];
  intake: Partial<Record<IntakeSection, Answers | undefined>>;
  consultations: ConsultationItem[];
  coaches: { id: string; name: string; specialities: Speciality[] }[];
  app: { usesApp: boolean; inviteActiveUntil: string | null; canInvite: boolean };
}

export interface NewClientInput {
  name: string;
  dateOfBirth: string;
  gender?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  occupation?: string | null;
  maritalStatus?: string | null;
  tracksCycle: boolean;
  consent: true;
  guardianConsent?: boolean;
}

export const GENDERS = ["Woman", "Man", "Non-binary", "Prefer not to say"];
export const MARITAL = ["Single", "Married", "Divorced", "Widowed", "Prefer not to say"];

/** "12 Dec 2026" from "2026-12-12". */
export const shortDate = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
