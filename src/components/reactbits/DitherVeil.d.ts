import type { CSSProperties } from "react";

export interface DitherVeilProps {
  /** Image to veil. Same-origin or data: URLs avoid the CORS requirement. */
  src?: string;
  fit?: "contain" | "cover";
  pattern?: "bayer" | "noise" | "atkinson" | "floyd" | "lines";
  palette?: "duotone" | "rgb";
  pixelSize?: number;
  levels?: number;
  inkColor?: string;
  paperColor?: string;
  contrast?: number;
  brightness?: number;
  revealRadius?: number;
  softness?: number;
  linger?: number;
  rimColor?: string;
  rim?: number;
  reverse?: boolean;
  wander?: boolean;
  clickBurst?: boolean;
  className?: string;
  style?: CSSProperties;
}

declare const DitherVeil: (props: DitherVeilProps) => JSX.Element;
export default DitherVeil;
