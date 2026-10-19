import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

export interface AnimatedContentProps extends Omit<HTMLAttributes<HTMLDivElement>, "onAnimationStart"> {
  children?: ReactNode;
  container?: string | HTMLElement;
  distance?: number;
  direction?: "vertical" | "horizontal";
  reverse?: boolean;
  duration?: number;
  ease?: string;
  initialOpacity?: number;
  animateOpacity?: boolean;
  scale?: number;
  blur?: number;
  rotate?: number;
  tilt?: number;
  wipe?: "none" | "up" | "down" | "left" | "right" | "center";
  threshold?: number;
  delay?: number;
  stagger?: number;
  staggerFrom?: "start" | "end" | "center" | "edges" | "random";
  trigger?: "scroll" | "mount";
  once?: boolean;
  scrub?: boolean | number;
  disappearAfter?: number;
  disappearDuration?: number;
  disappearEase?: string;
  onStart?: () => void;
  onComplete?: () => void;
  onDisappearanceComplete?: () => void;
  className?: string;
  style?: CSSProperties;
}

declare const AnimatedContent: (props: AnimatedContentProps) => JSX.Element;
export default AnimatedContent;
