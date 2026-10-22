import { describe, expect, it } from "vitest";
import { roleHome } from "./roleHome";

describe("roleHome", () => {
  it("sends each role to its own area", () => {
    expect(roleHome({ role: "admin", onboarded: true })).toBe("/admin");
    expect(roleHome({ role: "coach", onboarded: true })).toBe("/coach");
    expect(roleHome({ role: "woman", onboarded: true })).toBe("/app/dashboard");
  });

  it("sends a woman who has not finished setting up to onboarding, but not staff", () => {
    expect(roleHome({ role: "woman", onboarded: false })).toBe("/onboarding");
    expect(roleHome({ role: "admin", onboarded: false })).toBe("/admin");
    expect(roleHome({ role: "coach", onboarded: false })).toBe("/coach");
  });
});
