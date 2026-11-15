import { BadRequestError, ForbiddenError } from "@/lib/errors";

/**
 * The age gate's server side (mirrors src/lib/ageGate.ts in the web app). Women360 is for adults: its scope is 18 and
 * over, and under India's DPDP Act 2023 a person under 18 is a child whose data needs verifiable parental consent,
 * which Women360 does not collect. The refusal is deliberately neutral: it doesn't say which age was needed.
 */
export const MINIMUM_AGE = 18;

const todayUtc = () => new Date().toISOString().slice(0, 10);

export function ageOn(dateOfBirth: string, today: string): number {
  const [by, bm, bd] = dateOfBirth.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

/** Throws unless the date is a real, past date within 120 years and the person is an adult. */
export function assertAdultBirthDate(dateOfBirth: string, today = todayUtc()) {
  const d = new Date(`${dateOfBirth}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== dateOfBirth || dateOfBirth > today || ageOn(dateOfBirth, today) > 120) {
    throw new BadRequestError("Please enter a real date of birth.");
  }
  if (ageOn(dateOfBirth, today) < MINIMUM_AGE) {
    throw new ForbiddenError("Sorry, Women360 isn't available to you.");
  }
}

export function isAdult(dateOfBirth: Date | null, today = todayUtc()): boolean {
  return Boolean(dateOfBirth) && ageOn(dateOfBirth!.toISOString().slice(0, 10), today) >= MINIMUM_AGE;
}
