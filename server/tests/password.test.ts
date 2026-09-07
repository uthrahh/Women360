import { describe, expect, it } from "vitest";
import { hashPassword, isPasswordStrongEnough, verifyPassword } from "@/lib/password";

describe("password", () => {
  it("hashes and verifies a correct password", async () => {
    const hash = await hashPassword("a-reasonably-long-password");
    expect(await verifyPassword(hash, "a-reasonably-long-password")).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("a-reasonably-long-password");
    expect(await verifyPassword(hash, "wrong-password")).toBe(false);
  });

  it("never stores the plaintext password in the hash", async () => {
    const hash = await hashPassword("super-secret-value");
    expect(hash).not.toContain("super-secret-value");
  });

  it("enforces a minimum password length", () => {
    expect(isPasswordStrongEnough("short")).toBe(false);
    expect(isPasswordStrongEnough("this-is-long-enough")).toBe(true);
  });
});
