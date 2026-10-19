import type { CSSProperties, ReactNode } from "react";

export interface GooeyNavItem {
  label?: string;
  href?: string;
  icon?: ReactNode;
  /** Accessible name for an icon-only item. */
  ariaLabel?: string;
  /** The href is real, but a plain click is routed in-app through `onChange`. */
  client?: boolean;
}

export interface GooeyNavProps {
  items?: GooeyNavItem[];
  initialActiveIndex?: number;
  activeIndex?: number;
  onChange?: (index: number, item: GooeyNavItem) => void;
  theme?: "dark" | "light";
  /** Concrete #hex or rgb(): the pill is drawn by WebGL, which can't read CSS variables. */
  color?: string;
  activeTextColor?: string;
  colors?: string[];
  size?: "sm" | "md" | "lg";
  frame?: boolean;
  animationTime?: number;
  particleCount?: number;
  spread?: number;
  timeVariance?: number;
  gooeyness?: number;
  wobble?: number;
  hoverEffect?: boolean;
  className?: string;
  style?: CSSProperties;
}

declare const GooeyNav: (props: GooeyNavProps) => JSX.Element;
export default GooeyNav;
