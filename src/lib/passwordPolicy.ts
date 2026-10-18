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
