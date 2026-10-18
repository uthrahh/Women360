import crypto from "node:crypto";
import { safeEqual } from "@/lib/security/crypto";

/**
 * TOTP (RFC 6238) on top of HOTP (RFC 4226) with the parameters every
 * authenticator app defaults to: HMAC-SHA1, 6 digits, 30-second steps. Built
 * on Node's crypto rather than a dependency — it's ~40 lines and the RFC
 * publishes test vectors (see tests/totp.test.ts).
 */

export const STEP_SECONDS = 30;
const DIGITS = 6;
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = "";
  for (const byte of buf) bits += byte.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i < bits.length; i += 5) out += BASE32[parseInt(bits.slice(i, i + 5).padEnd(5, "0"), 2)];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/=+$/, "").replace(/\s+/g, "");
  let bits = "";
  for (const ch of clean) {
    const idx = BASE32.indexOf(ch);
    if (idx === -1) throw new Error("Invalid base32 character.");
    bits += idx.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

/** 160-bit secret, the size RFC 4226 recommends, as base32 for authenticator apps. */
export function generateSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

export function stepFor(timeMs: number): number {
  return Math.floor(timeMs / 1000 / STEP_SECONDS);
}

export function codeForStep(secretBase32: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = crypto.createHmac("sha1", base32Decode(secretBase32)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(binary % 10 ** DIGITS).padStart(DIGITS, "0");
}

/**
 * Returns the matched time step, or null. Accepts one step either side to
 * tolerate clock drift between the phone and the server. `lastUsedStep`
 * makes a code single-use: anything at or before the last accepted step is
 * refused, so a code someone shoulder-surfed or intercepted can't be replayed
 * inside its window.
 */
export function verifyTotp(secretBase32: string, code: string, lastUsedStep: number | null, nowMs = Date.now()): number | null {
  const normalized = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(normalized)) return null;
  const current = stepFor(nowMs);
  let matched: number | null = null;
  // Check every candidate (no early exit) so timing doesn't reveal which step matched.
  for (const step of [current - 1, current, current + 1]) {
    if (safeEqual(codeForStep(secretBase32, step), normalized) && matched === null) matched = step;
  }
  if (matched === null) return null;
  if (lastUsedStep !== null && matched <= lastUsedStep) return null;
  return matched;
}

export function otpauthUri(secretBase32: string, accountLabel: string, issuer = "Women360"): string {
  const label = encodeURIComponent(`${issuer}:${accountLabel}`);
  return `otpauth://totp/${label}?secret=${secretBase32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
}
