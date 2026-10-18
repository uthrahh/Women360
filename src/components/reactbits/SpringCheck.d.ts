import type { ReactNode } from "react";

export interface SpringCheckProps {
  label?: ReactNode;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  color?: string;
  fillColor?: string;
  checkColor?: string;
  boxSize?: number;
  boxRadius?: number;
  fontSize?: number;
  bounce?: number;
  strikeLag?: number;
  doneOpacity?: number;
  strike?: "left" | "center" | "right" | "none";
  ariaLabel?: string;
  className?: string;
}

declare const SpringCheck: (props: SpringCheckProps) => JSX.Element;
export default SpringCheck;
