import type { ReactNode } from "react";

export interface BranchedMenuChild {
  value: string;
  label: string;
  /** A Hugeicons icon object, or an already-rendered element (e.g. a lucide icon). */
  icon?: unknown | ReactNode;
}

export interface BranchedMenuItem {
  label: string;
  value?: string;
  children?: BranchedMenuChild[];
}

export interface BranchedMenuProps {
  items?: BranchedMenuItem[];
  defaultOpen?: number | number[];
  defaultActive?: string;
  /** Controlled selection; overrides the internal state when given. */
  active?: string;
  onSelect?: (value: string, item: BranchedMenuChild | BranchedMenuItem) => void;
  onToggle?: (index: number, open: boolean) => void;
  color?: string;
  accentColor?: string;
  lineColor?: string;
  width?: number;
  rowHeight?: number;
  indent?: number;
  trunk?: number;
  radius?: number;
  lineWidth?: number;
  fontSize?: number;
  drawDuration?: number;
  foldDuration?: number;
  className?: string;
}

declare const BranchedMenu: (props: BranchedMenuProps) => JSX.Element;
export default BranchedMenu;
