import { describe, expect, it } from "vitest";
import { generateRefreshToken, hashToken, signAccessToken, ttlToDate, verifyAccessToken } from "@/lib/jwt";

describe("jwt", () => {
  it("round-trips an access token", () => {
    const token = signAccessToken({ sub: "user_1", role: "WOMAN" });
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe("user_1");
    expect(payload.role).toBe("WOMAN");
  });

  it("rejects a tampered token", () => {
    const token = signAccessToken({ sub: "user_1", role: "WOMAN" });
    expect(() => verifyAccessToken(token.slice(0, -2) + "xx")).toThrow();
  });

  it("generates unique, high-entropy refresh tokens", () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a).not.toBe(b);
    expect(a).toHaveLength(96); // 48 bytes, hex-encoded
  });

  it("hashes a refresh token deterministically (for lookup by hash)", () => {
    const token = "same-input";
    expect(hashToken(token)).toBe(hashToken(token));
  });

  it("parses TTL strings into future dates", () => {
    const now = Date.now();
    expect(ttlToDate("15m").getTime()).toBeGreaterThan(now);
    expect(ttlToDate("30d").getTime()).toBeGreaterThan(ttlToDate("15m").getTime());
  });

  it("rejects an invalid TTL string", () => {
    expect(() => ttlToDate("not-a-ttl")).toThrow();
  });
});
