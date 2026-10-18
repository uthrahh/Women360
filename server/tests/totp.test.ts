import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "@/lib/security/crypto";
import { base32Decode, base32Encode, codeForStep, generateSecret, otpauthUri, stepFor, verifyTotp } from "@/lib/security/totp";

// RFC 6238 Appendix B (SHA-1): the shared secret is the ASCII string
// "12345678901234567890". The RFC lists 8-digit codes; ours are 6, i.e. the
// last six digits of each.
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));
const RFC_VECTORS: [number, string][] = [
  [59, "287082"],
  [1111111109, "081804"],
  [1111111111, "050471"],
  [1234567890, "005924"],
  [2000000000, "279037"],
  [20000000000, "353130"],
];

describe("base32", () => {
  it("matches the RFC 4648 test vectors (without padding)", () => {
    expect(base32Encode(Buffer.from("foobar"))).toBe("MZXW6YTBOI");
    expect(base32Encode(Buffer.from("foo"))).toBe("MZXW6");
    expect(base32Decode("MZXW6YTBOI======").toString()).toBe("foobar");
  });
  it("round-trips random bytes and ignores case and spacing", () => {
    const bytes = Buffer.from(Array.from({ length: 20 }, (_, i) => (i * 37 + 5) % 256));
    expect(base32Decode(base32Encode(bytes).toLowerCase().replace(/(.{4})/g, "$1 "))).toEqual(bytes);
  });
  it("rejects characters outside the alphabet", () => {
    expect(() => base32Decode("NOT*VALID")).toThrow();
  });
});

describe("TOTP", () => {
  it.each(RFC_VECTORS)("produces the RFC 6238 code at unix time %i", (time, expected) => {
    expect(codeForStep(RFC_SECRET, stepFor(time * 1000))).toBe(expected);
  });

  it("generates a 160-bit base32 secret, different every time", () => {
    const a = generateSecret();
    expect(a).toMatch(/^[A-Z2-7]{32}$/);
    expect(generateSecret()).not.toBe(a);
  });

  it("accepts the current code and one step of clock drift either way, but no more", () => {
    const now = 1234567890_000;
    const step = stepFor(now);
    expect(verifyTotp(RFC_SECRET, codeForStep(RFC_SECRET, step), null, now)).toBe(step);
    expect(verifyTotp(RFC_SECRET, codeForStep(RFC_SECRET, step - 1), null, now)).toBe(step - 1);
    expect(verifyTotp(RFC_SECRET, codeForStep(RFC_SECRET, step + 1), null, now)).toBe(step + 1);
    expect(verifyTotp(RFC_SECRET, codeForStep(RFC_SECRET, step - 2), null, now)).toBeNull();
    expect(verifyTotp(RFC_SECRET, codeForStep(RFC_SECRET, step + 2), null, now)).toBeNull();
  });

  it("refuses to accept the same code twice (replay protection)", () => {
    const now = 1234567890_000;
    const step = stepFor(now);
    const code = codeForStep(RFC_SECRET, step);
    expect(verifyTotp(RFC_SECRET, code, null, now)).toBe(step);
    expect(verifyTotp(RFC_SECRET, code, step, now)).toBeNull();
    // An older code than one already used is also refused.
    expect(verifyTotp(RFC_SECRET, codeForStep(RFC_SECRET, step - 1), step, now)).toBeNull();
  });

  it("rejects malformed input without throwing", () => {
    for (const bad of ["", "12345", "1234567", "abcdef", "12 34 5x"]) {
      expect(verifyTotp(RFC_SECRET, bad, null, 1234567890_000)).toBeNull();
    }
  });

  it("tolerates spaces in a pasted code", () => {
    const now = 1234567890_000;
    const code = codeForStep(RFC_SECRET, stepFor(now));
    expect(verifyTotp(RFC_SECRET, `${code.slice(0, 3)} ${code.slice(3)}`, null, now)).not.toBeNull();
  });

  it("builds an otpauth URI authenticator apps understand", () => {
    const uri = otpauthUri("JBSWY3DPEHPK3PXP", "priya@example.com");
    expect(uri).toBe(
      "otpauth://totp/Women360%3Apriya%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=Women360&algorithm=SHA1&digits=6&period=30"
    );
  });
});

describe("secret encryption (AES-256-GCM)", () => {
  it("round-trips a secret", () => {
    const secret = generateSecret();
    expect(decryptSecret(encryptSecret(secret))).toBe(secret);
  });

  it("never stores the plaintext and uses a fresh IV each time", () => {
    const secret = generateSecret();
    const a = encryptSecret(secret);
    const b = encryptSecret(secret);
    expect(a).not.toContain(secret);
    expect(a).not.toBe(b);
    expect(a.startsWith("v1:")).toBe(true);
  });

  it("detects tampering instead of returning garbage", () => {
    const [v, iv, tag, ct] = encryptSecret(generateSecret()).split(":");
    const flipped = Buffer.from(ct, "base64");
    flipped[0] ^= 0xff;
    expect(() => decryptSecret([v, iv, tag, flipped.toString("base64")].join(":"))).toThrow();
    expect(() => decryptSecret("v2:a:b:c")).toThrow();
  });
});
