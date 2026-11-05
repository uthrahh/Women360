// Encrypts and decrypts a backup file. A database dump holds people's health records, so it is never
// stored or uploaded unencrypted. AES-256-GCM with a key derived from a passphrase (scrypt); the file
// starts with a short header (format, salt, iv) and ends with the authentication tag, so a wrong
// passphrase or a file that was tampered with or cut short fails to decrypt instead of producing garbage.
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const MAGIC = Buffer.from("W360BK1\n");
const SALT_BYTES = 16;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const MIN_PASSPHRASE = 16;

function keyFrom(passphrase, salt) {
  if (typeof passphrase !== "string" || passphrase.length < MIN_PASSPHRASE) {
    throw new Error(`The backup passphrase must be at least ${MIN_PASSPHRASE} characters.`);
  }
  return scryptSync(passphrase, salt, 32, { N: 2 ** 15, r: 8, p: 1, maxmem: 128 * 1024 * 1024 });
}

export function encryptBuffer(plain, passphrase) {
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", keyFrom(passphrase, salt), iv);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([MAGIC, salt, iv, body, cipher.getAuthTag()]);
}

export function decryptBuffer(file, passphrase) {
  const headerLength = MAGIC.length + SALT_BYTES + IV_BYTES;
  if (file.length < headerLength + TAG_BYTES || !file.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error("This is not a Women360 backup file, or it is damaged.");
  }
  const salt = file.subarray(MAGIC.length, MAGIC.length + SALT_BYTES);
  const iv = file.subarray(MAGIC.length + SALT_BYTES, headerLength);
  const tag = file.subarray(file.length - TAG_BYTES);
  const body = file.subarray(headerLength, file.length - TAG_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", keyFrom(passphrase, salt), iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(body), decipher.final()]);
  } catch {
    throw new Error("Could not decrypt the backup: the passphrase is wrong, or the file was changed or cut short.");
  }
}

export function encryptFile(inPath, outPath, passphrase) {
  writeFileSync(outPath, encryptBuffer(readFileSync(inPath), passphrase));
}

export function decryptFile(inPath, outPath, passphrase) {
  writeFileSync(outPath, decryptBuffer(readFileSync(inPath), passphrase));
}
