import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

// The subset of React Bits' AnimatedContent that Women360 keeps (see the comment in AnimatedContent.jsx).
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
  threshold?: number;
  delay?: number;
  stagger?: number;
  trigger?: "scroll" | "mount";
  onStart?: () => void;
  onComplete?: () => void;
  className?: string;
  style?: CSSProperties;
}

declare const AnimatedContent: (props: AnimatedContentProps) => JSX.Element;
export default AnimatedContent;
