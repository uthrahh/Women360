import type { ReactNode } from "react";

export interface PeekRatingProps {
  value?: number;
  defaultValue?: number;
  onChange?: (value: number) => void;
  onPreview?: (value: number | null) => void;
  count?: number;
  shape?: "star" | "heart" | "bolt";
  icon?: ReactNode;
  labels?: string[];
  activeColor?: string;
  idleColor?: string;
  tipColor?: string;
  tipTextColor?: string;
  size?: number;
  lift?: number;
  magnify?: number;
  riseDuration?: number;
  popScale?: number;
  showTip?: boolean;
  allowClear?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}

declare const PeekRating: (props: PeekRatingProps) => JSX.Element;
export default PeekRating;
