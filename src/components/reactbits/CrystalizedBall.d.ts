import type { CSSProperties } from "react";

export type BallPreset = "plasma" | "aurora" | "nebula" | "ember" | "frost" | "solar" | "eclipse" | "abyss";

export interface CrystalizedBallProps {
  preset?: BallPreset;
  color?: string;
  theme?: "dark" | "light";
  size?: number;
  strands?: number;
  crackle?: number;
  flares?: number;
  glow?: number;
  sparks?: number;
  particleCount?: number;
  fill?: number;
  motion?: "rise" | "fall" | "drift" | "orbit";
  particleShape?: "square" | "round";
  depth?: number;
  sway?: number;
  twinkle?: number;
  haze?: number;
  speed?: number;
  dustSpeed?: number;
  interactive?: boolean;
  hoverStrength?: number;
  intro?: boolean;
  paused?: boolean;
  className?: string;
  style?: CSSProperties;
}

declare const CrystalizedBall: (props: CrystalizedBallProps) => JSX.Element;
export default CrystalizedBall;
