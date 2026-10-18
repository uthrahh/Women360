import { describe, expect, it } from "vitest";
import { checkPassword, passwordAcceptable } from "./passwordPolicy";

const ctx = { email: "priya.nair@example.com", name: "Priya Nair" };
const failing = (pw: string) => checkPassword(pw, ctx).filter((c) => !c.ok).map((c) => c.id);

describe("client password checks", () => {
  it("accepts a normal passphrase", () => {
    expect(passwordAcceptable("correct horse battery staple", ctx)).toBe(true);
  });
  it("flags each rule independently", () => {
    expect(failing("short-1")).toEqual(["length"]);
    expect(failing("Priya-loves-tea-9")).toEqual(["personal"]);
    expect(failing("Maple-12345-orbit")).toEqual(["runs"]);
    expect(failing("Zebra-aaaa-lamp-42")).toEqual(["runs"]);
  });
  it("doesn't call an empty password acceptable", () => {
    expect(passwordAcceptable("", ctx)).toBe(false);
  });
  it("agrees with the server about the cases the server tests", () => {
    for (const ok of ["a-long-enough-password", "Maple-orbit-lantern"]) expect(passwordAcceptable(ok, ctx)).toBe(true);
    for (const bad of ["Maple-edcba-orbit", "Orbit-asdfg-maple", "nair-is-my-surname"]) expect(passwordAcceptable(bad, ctx)).toBe(false);
  });
});
