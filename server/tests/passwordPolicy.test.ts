import { describe, expect, it } from "vitest";
import { checkPassword } from "@/lib/passwordPolicy";

const ctx = { email: "priya.nair@example.com", name: "Priya Nair" };

describe("password policy", () => {
  it("accepts a normal passphrase", () => {
    expect(checkPassword("correct horse battery staple", ctx)).toEqual([]);
    expect(checkPassword("a-long-enough-password", ctx)).toEqual([]);
  });

  it("requires at least 12 characters", () => {
    expect(checkPassword("Tr0ub4dor&3x", ctx)).toEqual([]); // exactly 12
    expect(checkPassword("Short-pw-11c", ctx)).toEqual([]); // 12
    expect(checkPassword("Short-pw-1c", ctx)[0]).toMatch(/at least 12/);
  });

  it("rejects an absurdly long password rather than hashing it", () => {
    expect(checkPassword("x1".repeat(100) + "-Qz", ctx).join(" ")).toMatch(/128 characters or fewer/);
  });

  it("rejects common passwords, including the usual decorations and substitutions", () => {
    for (const bad of ["Password123456", "password-password", "P@ssw0rd!!!!!", "iloveyou2024!!", "Welcome-To-2024", "qwerty-keyboard"]) {
      expect(checkPassword(bad, ctx).join(" "), bad).toMatch(/too easy to guess|sequences/);
    }
  });

  it("doesn't reject a long passphrase just because it mentions a common word", () => {
    expect(checkPassword("my password manager remembers everything", ctx)).toEqual([]);
  });

  it("rejects repeated characters and sequences", () => {
    expect(checkPassword("Zebra-aaaa-lamp-42", ctx).join(" ")).toMatch(/repeated|sequences/);
    expect(checkPassword("Maple-12345-orbit", ctx).join(" ")).toMatch(/sequences/);
    expect(checkPassword("Maple-edcba-orbit", ctx).join(" ")).toMatch(/sequences/);
    expect(checkPassword("Orbit-asdfg-maple", ctx).join(" ")).toMatch(/sequences/);
  });

  it("rejects a password containing the person's name or email", () => {
    expect(checkPassword("Priya-loves-tea-9", ctx)[0]).toMatch(/name or email/);
    expect(checkPassword("nair-is-my-surname", ctx)[0]).toMatch(/name or email/);
    expect(checkPassword("x-priya.nair@example.com-x", ctx)[0]).toMatch(/name or email/);
    expect(checkPassword("Maple-orbit-lantern", ctx)).toEqual([]);
  });

  it("ignores very short name fragments that would reject almost everything", () => {
    expect(checkPassword("Maple-orbit-lantern", { name: "Jo Li", email: "jo@x.co" })).toEqual([]);
  });
});
