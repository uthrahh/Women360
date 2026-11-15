/**
 * The age gate. Women360 is for adults: its stated scope is 18 and over, and under India's DPDP Act 2023 a person
 * under 18 is a child whose data needs verifiable parental consent, which Women360 does not collect. Mirrored on the
 * server (server/src/lib/age.ts), which has the final say.
 *
 * The screen is "neutral": it asks for a date of birth without saying what age is required, and after a no it does not
 * invite a second try with a different date (remembered on this device).
 */
export const MINIMUM_AGE = 18;
const DECLINED_KEY = "w360.ageDeclined";

/** Whole years between a date of birth and a day (both "YYYY-MM-DD"). */
export function ageOn(dateOfBirth: string, today: string): number {
  const [by, bm, bd] = dateOfBirth.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

export function oldEnough(dateOfBirth: string, today: string): boolean {
  return ageOn(dateOfBirth, today) >= MINIMUM_AGE;
}

/** A believable date of birth: a real date, not in the future, within 120 years. */
export function plausibleBirthDate(dateOfBirth: string, today: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return false;
  const d = new Date(`${dateOfBirth}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== dateOfBirth) return false;
  return dateOfBirth <= today && ageOn(dateOfBirth, today) <= 120;
}

export function rememberDeclined() {
  try {
    localStorage.setItem(DECLINED_KEY, "1");
  } catch {
    /* private mode */
  }
}

export function wasDeclined(): boolean {
  try {
    return localStorage.getItem(DECLINED_KEY) === "1";
  } catch {
    return false;
  }
}
