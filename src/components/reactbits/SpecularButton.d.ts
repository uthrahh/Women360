import type { CSSProperties, ElementType, MouseEvent, ReactNode } from "react";

export interface SpecularButtonProps {
  /** Element to render as. A router `Link` keeps navigation a real anchor. */
  as?: ElementType;
  children?: ReactNode;
  size?: "sm" | "md" | "lg";
  radius?: number;
  tint?: string;
  tintOpacity?: number;
  blur?: number;
  textColor?: string;
  /** Must be a concrete colour (hex/rgb): it is read by a canvas, not CSS. */
  lineColor?: string;
  /** Must be a concrete colour (hex/rgb): it is read by a canvas, not CSS. */
  baseColor?: string;
  intensity?: number;
  idleIntensity?: number;
  shineSize?: number;
  shineFade?: number;
  thickness?: number;
  glow?: number;
  speed?: number;
  followMouse?: boolean;
  proximity?: number;
  autoAnimate?: boolean;
  disabled?: boolean;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  className?: string;
  type?: "button" | "submit" | "reset";
  style?: CSSProperties;
  /** Anything else is passed to the rendered element (e.g. `to` for a router Link). */
  [key: string]: unknown;
}

declare const SpecularButton: (props: SpecularButtonProps) => JSX.Element;
export default SpecularButton;
