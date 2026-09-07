import argon2 from "argon2";

// Argon2id is the current OWASP-recommended password hash — memory-hard,
// resistant to GPU cracking, and does not require a separately-managed
// per-user salt/pepper scheme (argon2 handles the salt internally).
export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

const MIN_PASSWORD_LENGTH = 10;

export function isPasswordStrongEnough(plain: string): boolean {
  return plain.length >= MIN_PASSWORD_LENGTH;
}
