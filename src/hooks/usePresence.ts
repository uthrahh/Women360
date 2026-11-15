import { useEffect, useState } from "react";

/**
 * Keeps something on the page for a moment after it is closed, so it can animate out (an exit is about 20% shorter than its entrance).
 * Render while `mounted`, and set data-state={state} on it; the CSS (.w360-pop, .w360-toast) does the rest.
 */
export function usePresence(open: boolean, exitMs = 160) {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    const t = setTimeout(() => setMounted(false), exitMs);
    return () => clearTimeout(t);
  }, [open, exitMs]);
  return { mounted: mounted || open, state: open ? ("open" as const) : ("closed" as const) };
}
