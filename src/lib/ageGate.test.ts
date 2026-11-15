import { describe, expect, it } from "vitest";
import { ageOn, oldEnough, plausibleBirthDate } from "./ageGate";

describe("age gate", () => {
  it("counts whole years, turning over on the birthday itself", () => {
    expect(ageOn("2008-11-15", "2026-11-15")).toBe(18);
    expect(ageOn("2008-11-16", "2026-11-15")).toBe(17);
    expect(ageOn("2008-12-01", "2026-11-15")).toBe(17);
    expect(ageOn("1950-01-01", "2026-11-15")).toBe(76);
  });

  it("lets adults in from their 18th birthday", () => {
    expect(oldEnough("2008-11-15", "2026-11-15")).toBe(true);
    expect(oldEnough("2008-11-16", "2026-11-15")).toBe(false);
  });

  it("handles a 29 February birthday", () => {
    expect(ageOn("2008-02-29", "2026-02-28")).toBe(17);
    expect(ageOn("2008-02-29", "2026-03-01")).toBe(18);
  });

  it("refuses impossible or future dates", () => {
    expect(plausibleBirthDate("1990-02-30", "2026-11-15")).toBe(false);
    expect(plausibleBirthDate("2027-01-01", "2026-11-15")).toBe(false);
    expect(plausibleBirthDate("1890-01-01", "2026-11-15")).toBe(false);
    expect(plausibleBirthDate("not-a-date", "2026-11-15")).toBe(false);
    expect(plausibleBirthDate("1990-02-28", "2026-11-15")).toBe(true);
  });
});
