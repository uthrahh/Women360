import type { CSSProperties, ReactNode } from "react";

export interface AnimatedListItem {
  id?: string | number;
  icon?: ReactNode;
  image?: string;
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
}

export interface AnimatedListProps<T = AnimatedListItem | string> {
  items?: T[];
  onItemSelect?: (item: T, index: number) => void;
  renderItem?: (item: T, index: number, selected: boolean) => ReactNode;
  initialSelectedIndex?: number;
  selectOnHover?: boolean;
  enableArrowNavigation?: boolean;
  loop?: boolean;
  animation?: "pop" | "slide" | "fade" | "none";
  animateOnce?: boolean;
  stagger?: number;
  showGradients?: boolean;
  fadeSize?: number;
  displayScrollbar?: boolean;
  frame?: boolean;
  theme?: "dark" | "light";
  accentColor?: string;
  radius?: number;
  gap?: number;
  width?: number | string;
  maxHeight?: number | string;
  className?: string;
  itemClassName?: string;
  /** The list's accessible name, announced by screen readers. */
  ariaLabel?: string;
  style?: CSSProperties;
}

declare function AnimatedList<T = AnimatedListItem | string>(props: AnimatedListProps<T>): JSX.Element;
export default AnimatedList;
