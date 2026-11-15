import { useApp } from "@/context/AppContext";

// A few React Bits components read their colours from a canvas or compute
// contrast from a hex string, so they can't take `var(--w360-*)`. These are
// the same values as the CSS tokens in index.css, resolved for the active theme.
export function useBrandColors() {
  const { theme } = useApp();
  const dark = theme.theme === "dark";
  return {
    dark,
    accent: dark ? "#FF3EA5" : "#D6006F",
    accentStrong: dark ? "#FF7CBB" : "#B8005F",
    ink: dark ? "#FFFFFF" : "#0A0A0A",
    inkOnAccent: dark ? "#000000" : "#FFFFFF",
    muted: dark ? "#A3A3A3" : "#5C5C5C",
    paper: dark ? "#000000" : "#FFFFFF",
    raised: dark ? "#0D0D0D" : "#FFFFFF",
    tint: dark ? "#1F0712" : "#FFF2F8",
    tintText: dark ? "#FFB8DA" : "#8A0047",
    border: dark ? "#262626" : "#E6E6E6",
  } as const;
}
