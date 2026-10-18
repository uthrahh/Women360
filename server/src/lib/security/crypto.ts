import crypto from "node:crypto";
import { env } from "@/config/env";

/**
 * AES-256-GCM for secrets that must be recoverable (a person's authenticator
 * secret — unlike a password it can't be hashed, the server has to read it
 * back to check codes). GCM authenticates as well as encrypts, so a tampered
 * value fails to decrypt instead of yielding garbage.
 *
 * Stored as "v1:<iv>:<tag>:<ciphertext>" (base64), with a fresh random IV
 * every time. The leading version lets the key or scheme rotate later.
 */

function key(): Buffer {
  if (!env.twoFactorKey) throw new Error("TWO_FACTOR_ENCRYPTION_KEY is not configured.");
  return env.twoFactorKey;
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), ciphertext.toString("base64")].join(":");
}

export function decryptSecret(stored: string): string {
  const [version, iv, tag, ciphertext] = stored.split(":");
  if (version !== "v1" || !iv || !tag || !ciphertext) throw new Error("Unrecognised secret format.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64")), decipher.final()]).toString("utf8");
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}
