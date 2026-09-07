import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "@/modules/auth/auth.validation";
import { cycleEntrySchema } from "@/modules/cycle/cycle.validation";

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
