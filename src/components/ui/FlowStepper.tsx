import type { CSSProperties } from "react";
import Stepper, { Step, type StepperProps } from "@/components/reactbits/Stepper";

export { Step };

// Stepper ships with its own dark/light palettes and a frosted frame. For
// multi-step flows (profile set-up and the like) this points every one of its
// colour variables at the app's tokens and drops the frame, so the flow sits
// on the page in our light and dark themes.
const THEME: CSSProperties = {
  ["--stepper-tile" as string]: "var(--w360-bg-raised)",
  ["--stepper-tile-edge" as string]: "var(--w360-border)",
  ["--stepper-tile-highlight" as string]: "transparent",
  ["--stepper-tile-shadow" as string]: "0 0 0 0 transparent",
  ["--stepper-well" as string]: "var(--w360-bg-warm)",
  ["--stepper-track" as string]: "var(--w360-border)",
  ["--stepper-ink" as string]: "var(--w360-text)",
  ["--stepper-muted" as string]: "var(--w360-text-muted)",
  ["--stepper-faint" as string]: "var(--w360-border)",
  ["--stepper-ring" as string]: "var(--w360-focus)",
  ["--stepper-solid" as string]: "var(--w360-accent)",
  ["--stepper-solid-ink" as string]: "var(--w360-bg)",
  ["--stepper-hover" as string]: "none",
  ["--stepper-hover-fill" as string]: "color-mix(in srgb, var(--w360-text) 4%, transparent)",
  ["--stepper-solid-hover" as string]: "brightness(0.92)",
  ["--stepper-press" as string]: "brightness(0.9)",
};

export function FlowStepper({ style, ...props }: StepperProps) {
  return <Stepper frame={false} width="100%" radius={16} {...props} style={{ ...THEME, ...style }} />;
}
