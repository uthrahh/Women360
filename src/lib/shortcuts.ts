/**
 * Keyboard shortcuts for the signed-in app. Defined once: the command menu draws its hints from this list and the key handler
 * reads the same list, so what is shown is what works.
 *
 * Go to a screen: press G, then a letter ("G then H" opens Habits). Open the command menu: Ctrl+K (Command+K on a Mac), or ?.
 */
export const OPEN_COMMAND_MENU_EVENT = "w360:open-command-menu";

/** Letter pressed after G, by destination. */
export const GO_KEYS: Record<string, string> = {
  "/app/dashboard": "d",
  "/app/habits": "h",
  "/app/cycle": "c",
  "/app/nutrition": "n",
  "/app/activity": "a",
  "/app/sleep": "s",
  "/app/wellbeing": "w",
  "/app/goals": "g",
  "/app/health": "e",
  "/app/insights": "i",
  "/app/reports": "r",
  "/app/learn": "l",
  "/app/messages": "m",
  "/app/settings": ",",
};

export function isMac(): boolean {
  return typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
}

/** "Ctrl" or "⌘", for the hint on the command menu button. */
export function modKeyLabel(): string {
  return isMac() ? "⌘" : "Ctrl";
}

/** True when the key press is going into something she is typing in, so single-letter shortcuts must stay out of the way. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/** How long after G the next letter still counts. */
export const GO_WINDOW_MS = 1200;

/** Which destination a letter pressed after G means, if any. */
export function destinationFor(letter: string): string | undefined {
  const key = letter.toLowerCase();
  return Object.entries(GO_KEYS).find(([, k]) => k === key)?.[0];
}

/** Simple, forgiving matching for the menu: every word typed must appear somewhere in the label or its keywords. */
export function matchesQuery(query: string, ...haystack: string[]): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const text = haystack.join(" ").toLowerCase();
  return words.every((w) => text.includes(w));
}
