import { describe, expect, it } from "vitest";
import { routeShape } from "./reportError";

describe("the screen named in a crash report", () => {
  it("keeps the screen and drops anything that looks like a record id", () => {
    expect(routeShape("/app/dashboard")).toBe("/app/dashboard");
    expect(routeShape("/app/goals/ckx9abc123def456ghi789")).toBe("/app/goals/:id");
    expect(routeShape("/app/health/12345")).toBe("/app/health/:id");
    expect(routeShape("/reset-password/3f2a9c1e-1111-2222-3333-abcdefabcdef")).toBe("/reset-password/:id");
  });
  it("never carries a query string or odd characters", () => {
    expect(routeShape("/app/cycle?email=a@b.co")).toBe("/app/cycle");
    expect(routeShape("/")).toBe("/");
    expect(routeShape("")).toBe("/");
  });
});
