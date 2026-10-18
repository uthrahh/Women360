import { COMMON_PASSWORD_WORDS } from "@/lib/commonPasswords";
import { AppError } from "@/lib/errors";

export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 128;

const KEYBOARD_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm", "1234567890"];

export interface PasswordContext {
  email?: string;
  name?: string;
}

/** Thrown by the auth service so the person sees the specific reason (not the generic "some information isn't valid"). */
export class WeakPasswordError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 422, "WEAK_PASSWORD", details);
  }
}

function hasLongRun(password: string): boolean {
  if (/(.)\1{3,}/.test(password)) return true; // aaaa, 1111

  const lower = password.toLowerCase();
  // Four steps in the same direction = a run of five: 12345, abcde, 54321.
  let ascending = 1;
  let descending = 1;
  for (let i = 1; i < lower.length; i++) {
    const diff = lower.charCodeAt(i) - lower.charCodeAt(i - 1);
    const alnum = /[a-z0-9]/.test(lower[i]) && /[a-z0-9]/.test(lower[i - 1]);
    ascending = alnum && diff === 1 ? ascending + 1 : 1;
    descending = alnum && diff === -1 ? descending + 1 : 1;
    if (ascending >= 5 || descending >= 5) return true;
  }

  // qwert, asdfg, zxcvb, and their reverses.
  for (const row of KEYBOARD_ROWS) {
    const reversed = [...row].reverse().join("");
    for (let i = 0; i + 5 <= row.length; i++) {
      if (lower.includes(row.slice(i, i + 5)) || lower.includes(reversed.slice(i, i + 5))) return true;
    }
  }
  return false;
}

function isCommon(password: string): boolean {
  const lower = password.toLowerCase();
  // "P@ssw0rd!!" -> "psswrd" is too lossy; map the usual substitutions first.
  const unleeted = lower.replace(/0/g, "o").replace(/[1!|]/g, "i").replace(/3/g, "e").replace(/[4@]/g, "a").replace(/[5$]/g, "s");
  const letters = unleeted.replace(/[^a-z]/g, "");
  if (letters.length === 0) return false;
  // Strip every occurrence of every common word (longest first) and see how
  // much of the password they account for. "iloveyou2024!!",
  // "password-password" and "MyPassword-Women360" are almost entirely common
  // words and as guessable as one; a long passphrase that merely mentions
  // one ("my password manager remembers everything") isn't.
  let remaining = letters;
  for (const word of [...COMMON_PASSWORD_WORDS].sort((a, b) => b.length - a.length)) {
    remaining = remaining.split(word).join("");
  }
  return letters.length - remaining.length >= letters.length * 0.6;
}

function tokens(value: string | undefined): string[] {
  return (value ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);
}

function containsPersonalInfo(password: string, ctx: PasswordContext): boolean {
  const lower = password.toLowerCase();
  const email = ctx.email?.toLowerCase();
  if (email && lower.includes(email)) return true;
  const emailLocal = email?.split("@")[0];
  return [...tokens(emailLocal), ...tokens(ctx.name)].some((t) => lower.includes(t));
}

/** Every rule the password breaks, in the order worth showing. Empty means acceptable. */
export function checkPassword(password: string, ctx: PasswordContext = {}): string[] {
  const problems: string[] = [];
  if (password.length < MIN_PASSWORD_LENGTH) {
    problems.push(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    problems.push(`Use ${MAX_PASSWORD_LENGTH} characters or fewer.`);
  }
  if (containsPersonalInfo(password, ctx)) {
    problems.push("Your password can't contain your name or email.");
  }
  if (isCommon(password)) {
    problems.push("That password is too easy to guess. Try a short phrase of a few unrelated words.");
  }
  if (hasLongRun(password)) {
    problems.push("Avoid repeated characters and sequences like 12345 or abcde.");
  }
  return problems;
}

export function assertPasswordAcceptable(password: string, ctx: PasswordContext = {}): void {
  const problems = checkPassword(password, ctx);
  if (problems.length > 0) throw new WeakPasswordError(problems[0], { problems });
}
