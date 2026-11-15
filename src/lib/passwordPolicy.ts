// Client-side mirror of server/src/lib/passwordPolicy.ts, for live feedback
// while typing. The server is the authority — and also rejects common
// passwords, a list deliberately not shipped to the browser.
export const MIN_PASSWORD_LENGTH = 12;

const KEYBOARD_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm", "1234567890"];

export interface PasswordContext {
  email?: string;
  name?: string;
}

export interface PasswordCheck {
  id: "length" | "personal" | "runs";
  label: string;
  ok: boolean;
}

function tokens(value: string | undefined): string[] {
  return (value ?? "").toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3);
}

function hasLongRun(password: string): boolean {
  if (/(.)\1{3,}/.test(password)) return true;
  const lower = password.toLowerCase();
  let up = 1;
  let down = 1;
  for (let i = 1; i < lower.length; i++) {
    const diff = lower.charCodeAt(i) - lower.charCodeAt(i - 1);
    const alnum = /[a-z0-9]/.test(lower[i]) && /[a-z0-9]/.test(lower[i - 1]);
    up = alnum && diff === 1 ? up + 1 : 1;
    down = alnum && diff === -1 ? down + 1 : 1;
    if (up >= 5 || down >= 5) return true;
  }
  return KEYBOARD_ROWS.some((row) => {
    const rev = [...row].reverse().join("");
    for (let i = 0; i + 5 <= row.length; i++) {
      if (lower.includes(row.slice(i, i + 5)) || lower.includes(rev.slice(i, i + 5))) return true;
    }
    return false;
  });
}

export function checkPassword(password: string, ctx: PasswordContext = {}): PasswordCheck[] {
  const lower = password.toLowerCase();
  const email = ctx.email?.trim().toLowerCase();
  const personal =
    password.length > 0 &&
    ((email ? lower.includes(email) : false) ||
      [...tokens(email?.split("@")[0]), ...tokens(ctx.name)].some((t) => lower.includes(t)));
  return [
    { id: "length", label: `At least ${MIN_PASSWORD_LENGTH} characters`, ok: password.length >= MIN_PASSWORD_LENGTH },
    { id: "personal", label: "Doesn't contain your name or email", ok: !personal },
    { id: "runs", label: "No repeated characters or sequences like 12345", ok: !hasLongRun(password) },
  ];
}

export const passwordAcceptable = (password: string, ctx?: PasswordContext) =>
  password.length > 0 && checkPassword(password, ctx).every((c) => c.ok);

export interface PasswordStrength {
  /** 0 empty, 1 not acceptable yet, 2 acceptable, 3 strong, 4 very strong. */
  level: 0 | 1 | 2 | 3 | 4;
  /** 0-1, how much of the outline is drawn. */
  fraction: number;
  /** One calm line: what's missing, or how strong it is. Never a list. */
  message: string;
  acceptable: boolean;
}

/** Rough guessing difficulty in bits: length times the size of the alphabet it draws on. */
function entropyBits(password: string) {
  let pool = 0;
  if (/[a-z]/.test(password)) pool += 26;
  if (/[A-Z]/.test(password)) pool += 26;
  if (/[0-9]/.test(password)) pool += 10;
  if (/[^a-zA-Z0-9]/.test(password)) pool += 33;
  return password.length * Math.log2(Math.max(pool, 1));
}

export function passwordStrength(password: string, ctx: PasswordContext = {}): PasswordStrength {
  if (!password) return { level: 0, fraction: 0, message: `Use at least ${MIN_PASSWORD_LENGTH} characters, or let us suggest one.`, acceptable: false };
  const checks = checkPassword(password, ctx);
  const bits = entropyBits(password);
  const fraction = Math.min(1, bits / 90);
  const missing = checks.find((c) => !c.ok);
  if (missing) {
    const message =
      missing.id === "length"
        ? `${MIN_PASSWORD_LENGTH - password.length} more character${MIN_PASSWORD_LENGTH - password.length === 1 ? "" : "s"} to go.`
        : missing.id === "personal"
          ? "Leave out your name and email."
          : "Avoid repeats and runs like 12345 or qwerty.";
    return { level: 1, fraction: Math.min(fraction, 0.45), message, acceptable: false };
  }
  if (bits >= 90) return { level: 4, fraction: 1, message: "Very strong.", acceptable: true };
  if (bits >= 70) return { level: 3, fraction, message: "Strong.", acceptable: true };
  return { level: 2, fraction: Math.max(fraction, 0.5), message: "Good. Longer is stronger.", acceptable: true };
}

// Letters and digits that can't be mistaken for each other (no 0/O, 1/l/I), in groups of four.
const SAFE = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** A strong suggestion: four groups of four from an unambiguous alphabet (about 92 bits), checked against the rules. */
export function suggestPassword(ctx: PasswordContext = {}, random: (n: number) => number = cryptoRandom): string {
  for (;;) {
    const groups = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => SAFE[random(SAFE.length)]).join(""));
    const candidate = groups.join("-");
    // Make sure every kind of character is present, and that it passes the same rules as a typed one.
    if (/[a-z]/.test(candidate) && /[A-Z]/.test(candidate) && /[0-9]/.test(candidate) && passwordAcceptable(candidate, ctx)) return candidate;
  }
}

function cryptoRandom(n: number): number {
  // Rejection sampling, so every character is equally likely.
  const limit = Math.floor(0x100000000 / n) * n;
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % n;
  }
}
