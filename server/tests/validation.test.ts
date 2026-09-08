import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "@/modules/auth/auth.validation";
import { cycleEntrySchema } from "@/modules/cycle/cycle.validation";
import { sleepEntrySchema } from "@/modules/sleep/sleep.validation";
import { mealEntrySchema } from "@/modules/nutrition/nutrition.validation";

describe("auth validation", () => {
  it("accepts a well-formed registration payload", () => {
    const result = registerSchema.safeParse({
      name: "Sarah Menon",
      email: "Sarah@Example.com",
      password: "a-long-enough-password",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      // email is normalized to lowercase
      expect(result.data.email).toBe("sarah@example.com");
    }
  });

  it("rejects a short password", () => {
    const result = registerSchema.safeParse({
      name: "Sarah Menon",
      email: "sarah@example.com",
      password: "short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed email on login", () => {
    const result = loginSchema.safeParse({ email: "not-an-email", password: "x" });
    expect(result.success).toBe(false);
  });
});

describe("cycle validation", () => {
  it("accepts a valid cycle entry", () => {
    const result = cycleEntrySchema.safeParse({
      date: "2026-05-01",
      isPeriod: true,
      flow: "MEDIUM",
      pain: 2,
      symptoms: ["Cramps"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an out-of-range pain score", () => {
    const result = cycleEntrySchema.safeParse({ date: "2026-05-01", pain: 9 });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed date", () => {
    const result = cycleEntrySchema.safeParse({ date: "05/01/2026" });
    expect(result.success).toBe(false);
  });
});

describe("sleep validation", () => {
  const base = { date: "2026-05-01", durationHours: 8, bedtime: "11:00 PM", wakeTime: "7:00 AM" };

  it("accepts a quality rating of 1 through 5", () => {
    for (const quality of [1, 2, 3, 4, 5]) {
      expect(sleepEntrySchema.safeParse({ ...base, quality }).success).toBe(true);
    }
  });

  it("rejects a quality of 0 (below the 1-5 scale)", () => {
    expect(sleepEntrySchema.safeParse({ ...base, quality: 0 }).success).toBe(false);
  });

  it("rejects a percentage-style quality value like 70", () => {
    expect(sleepEntrySchema.safeParse({ ...base, quality: 70 }).success).toBe(false);
  });

  it("rejects a non-integer quality", () => {
    expect(sleepEntrySchema.safeParse({ ...base, quality: 3.5 }).success).toBe(false);
  });
});

describe("nutrition validation", () => {
  const base = { date: "2026-05-01", time: "12:00 PM", name: "Lunch", servings: "1 bowl" };

  it("accepts whole numbers and one-decimal values", () => {
    const result = mealEntrySchema.safeParse({ ...base, calories: 420, proteinG: 12.3, fibreG: 4.5 });
    expect(result.success).toBe(true);
  });

  it("rejects more than one decimal place", () => {
    expect(mealEntrySchema.safeParse({ ...base, calories: 420.55, proteinG: 12, fibreG: 4 }).success).toBe(false);
    expect(mealEntrySchema.safeParse({ ...base, calories: 420, proteinG: 12.34, fibreG: 4 }).success).toBe(false);
  });

  it("rejects negative nutrient values", () => {
    expect(mealEntrySchema.safeParse({ ...base, calories: -5, proteinG: 12, fibreG: 4 }).success).toBe(false);
  });

  it("does not round 12.5 down to 12 — it's accepted as-is, not truncated", () => {
    const result = mealEntrySchema.safeParse({ ...base, calories: 420, proteinG: 12.5, fibreG: 4 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.proteinG).toBe(12.5);
  });
});
