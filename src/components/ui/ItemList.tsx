import type { CSSProperties } from "react";
import AnimatedList, { type AnimatedListProps } from "@/components/reactbits/AnimatedList";

// AnimatedList ships with its own dark/light palettes; this points every one of
// its colour variables at the app's tokens instead, so lists follow our light
// and dark themes (and the Senior Mode scale) rather than a second palette.
const THEME: CSSProperties = {
  ["--al-tile" as string]: "var(--w360-bg-raised)",
  ["--al-tile-edge" as string]: "var(--w360-border)",
  ["--al-tile-highlight" as string]: "transparent",
  ["--al-tile-shadow" as string]: "none",
  ["--al-well" as string]: "var(--w360-tint)",
  ["--al-ink" as string]: "var(--w360-text)",
  ["--al-muted" as string]: "var(--w360-text-muted)",
  ["--al-thumb" as string]: "var(--w360-border)",
  ["--al-ring" as string]: "var(--w360-accent)",
  ["--al-ring-fill" as string]: "color-mix(in srgb, var(--w360-accent) 6%, transparent)",
  ["--al-accent" as string]: "var(--w360-focus)",
  ["--al-hover" as string]: "none",
  ["--al-press" as string]: "none",
  ["--al-active" as string]: "none",
};

/**
 * The app's list: rows slide in as they scroll into view, arrow keys / Home /
 * End move through them, and Enter or a click picks one. No frame or glass —
 * just the rows, in our own tokens.
 */
export function ItemList<T>({ style, ...props }: AnimatedListProps<T>) {
  return (
    <AnimatedList<T>
      frame={false}
      width="100%"
      radius={16}
      gap={8}
      animation="slide"
      animateOnce
      maxHeight={480}
      fadeSize={32}
      {...props}
      style={{ ...THEME, ...style }}
    />
  );
}
