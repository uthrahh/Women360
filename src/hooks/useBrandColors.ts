import { useApp } from "@/context/AppContext";

// A few React Bits components read their colours from a canvas or compute
// contrast from a hex string, so they can't take `var(--w360-*)`. These are
// the same values as the CSS tokens in index.css, resolved for the active theme.
export function useBrandColors() {
  const { theme } = useApp();
  const dark = theme.theme === "dark";
  return {
    dark,
    accent: dark ? "#D0899A" : "#6B1D30",
    accentStrong: dark ? "#E6BFC9" : "#521626",
    ink: dark ? "#F5EFE8" : "#171310",
    inkOnAccent: dark ? "#171310" : "#FFFFFF",
    muted: dark ? "#B8AA9C" : "#665A4E",
    paper: dark ? "#15100E" : "#FBF8F4",
    raised: dark ? "#1E1815" : "#FFFFFF",
    border: dark ? "#372E28" : "#E2D9CF",
  } as const;
}
