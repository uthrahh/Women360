import { useCallback, useEffect, useLayoutEffect, useState } from "react";

export type ThemeMode = "light" | "dark";
type Preference = ThemeMode | "system";
const KEY = "w360_theme";

function readPreference(): Preference {
  try {
    const stored = localStorage.getItem(KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

const systemTheme = (): ThemeMode =>
  window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";

/**
 * Light/dark mode. Until the person picks one, the app follows their device and
 * changes with it; picking one (toggle or Settings) pins it. Only an explicit
 * choice is stored, so "follow my device" survives a reload.
 */
export function useTheme() {
  const [preference, setPreference] = useState<Preference>(readPreference);
  const [system, setSystem] = useState<ThemeMode>(systemTheme);

  useEffect(() => {
    const query = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!query) return;
    const onChange = () => setSystem(query.matches ? "dark" : "light");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const theme: ThemeMode = preference === "system" ? system : preference;

  // Layout effect so the class is on <html> before the first paint of a
  // re-render, not a frame after it.
  useLayoutEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  const choose = useCallback((next: Preference) => {
    setPreference(next);
    try {
      if (next === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {
      // Storage can be blocked (private windows); the choice still applies for this visit.
    }
  }, []);

  const setTheme = useCallback((next: ThemeMode) => choose(next), [choose]);
  const toggle = useCallback(() => choose(theme === "light" ? "dark" : "light"), [choose, theme]);
  const followDevice = useCallback(() => choose("system"), [choose]);

  return { theme, setTheme, toggle, followDevice, followingDevice: preference === "system" };
}
