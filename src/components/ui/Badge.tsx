import { HTMLAttributes } from "react";
import clsx from "clsx";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: "neutral" | "accent" | "success" | "warning";
}

const tones: Record<string, string> = {
  neutral: "bg-warmgrey-100 text-ink-800 dark:bg-white/10 dark:text-warmgrey-100",
  accent: "bg-maroon-100 text-maroon-800 dark:bg-maroon-900/50 dark:text-maroon-200",
  success: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
};

export function Badge({ tone = "neutral", className, children, ...props }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        tones[tone],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
