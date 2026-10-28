// Which instruction hints this browser has already shown once. A hint appears the first
// time someone meets it; after that it only appears when she asks for tips (the Help
// button). Browser storage can be unavailable, so every access is guarded and a failure
// simply means "show it".
const KEY = "w360:hints-seen";

function read(): string[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function hintSeen(id: string): boolean {
  return read().includes(id);
}

export function markHintSeen(id: string): void {
  try {
    const seen = read();
    if (!seen.includes(id)) window.localStorage.setItem(KEY, JSON.stringify([...seen, id]));
  } catch {
    // Storage unavailable (private window, blocked site data): the hint will just show again.
  }
}
