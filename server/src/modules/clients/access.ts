/**
 * Which parts of a client's record a coach sees, by speciality. Pure and unit-tested; the one place this is decided.
 *
 * A practice has several coaches, each with one or more specialities, and a client can have several coaches. Every coach of hers
 * sees her basic details (name, age, gender, contact) so they can reach her. Each other section goes only to the specialities it
 * concerns; a general wellness coach sees every section. A consultation is seen by the coaches who share the speciality it was
 * written in. A coach with no speciality set is treated as general until an administrator narrows it.
 */

export type Speciality = "GENERAL" | "NUTRITION" | "FITNESS" | "WELLBEING" | "WOMENS_HEALTH";
export const SPECIALITIES: { code: Speciality; label: string }[] = [
  { code: "GENERAL", label: "General wellness" },
  { code: "NUTRITION", label: "Nutrition" },
  { code: "FITNESS", label: "Fitness and physiotherapy" },
  { code: "WELLBEING", label: "Mental wellbeing" },
  { code: "WOMENS_HEALTH", label: "Women's health" },
];

export type Section = "measurements" | "lifestyle" | "medical" | "menstrual" | "dietary";
export const SECTIONS: Section[] = ["measurements", "lifestyle", "medical", "menstrual", "dietary"];

/** The specialities each section is for (GENERAL sees all of them). */
export const SECTION_AREAS: Record<Section, Speciality[]> = {
  measurements: ["NUTRITION", "FITNESS"],
  lifestyle: ["NUTRITION", "FITNESS", "WELLBEING"],
  medical: ["NUTRITION", "FITNESS", "WOMENS_HEALTH"],
  menstrual: ["NUTRITION", "WOMENS_HEALTH"],
  dietary: ["NUTRITION"],
};

export const effective = (specialities: Speciality[]): Speciality[] => (specialities.length === 0 ? ["GENERAL"] : specialities);

export function canSee(section: Section, specialities: Speciality[]): boolean {
  const mine = effective(specialities);
  return mine.includes("GENERAL") || SECTION_AREAS[section].some((a) => mine.includes(a));
}

export const visibleSections = (specialities: Speciality[]): Section[] => SECTIONS.filter((s) => canSee(s, specialities));

/** The kinds of daily log each speciality sees, for a client who logs in the app herself. Her private notes are never part of it. */
export type LogKind = "food" | "movement" | "mind" | "sleep" | "cycle";
export const LOG_AREAS: Record<LogKind, Speciality[]> = {
  food: ["NUTRITION"],
  movement: ["FITNESS"],
  mind: ["WELLBEING"],
  sleep: ["WELLBEING", "FITNESS"],
  cycle: ["WOMENS_HEALTH", "NUTRITION"],
};
export function visibleLogs(specialities: Speciality[]): LogKind[] {
  const mine = effective(specialities);
  return (Object.keys(LOG_AREAS) as LogKind[]).filter((k) => mine.includes("GENERAL") || LOG_AREAS[k].some((a) => mine.includes(a)));
}

/** A consultation written in `area` is for coaches in that area, and for general coaches. */
export function canSeeConsultation(area: Speciality, specialities: Speciality[]): boolean {
  const mine = effective(specialities);
  return mine.includes("GENERAL") || mine.includes(area);
}
