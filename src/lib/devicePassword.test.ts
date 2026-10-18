import { describe, expect, it } from "vitest";
import { DEVICE_PASSWORD_ALPHABET, randomDevicePassword } from "./devicePassword";

describe("randomDevicePassword", () => {
  it("is long, URL-safe and different every time", () => {
    const a = randomDevicePassword();
    const b = randomDevicePassword();
    expect(a.length).toBeGreaterThanOrEqual(42);
    expect([...a].every((c) => DEVICE_PASSWORD_ALPHABET.test(c))).toBe(true);
    expect(a).not.toBe(b);
  });

  it("never contains four identical characters in a row (the server rejects that)", () => {
    for (let i = 0; i < 2000; i++) expect(randomDevicePassword()).not.toMatch(/(.)\1{3}/);
  });
});
