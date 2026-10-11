import { HTMLAttributes } from "react";
import clsx from "clsx";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  // "tint" is a borderless accent-wash surface for a screen's single focal
  // block; everything else stays the quiet bordered default.
  tone?: "default" | "tint";
}

export function Card({ className, children, tone = "default", ...props }: CardProps) {
  return (
    <div
      className={clsx(
        "rounded-[var(--w360-radius-card)]",
        tone === "tint"
          ? "bg-[var(--w360-tint)] text-[var(--w360-tint-text)]"
          : "bg-[var(--w360-bg-raised)] border border-[var(--w360-border)]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx("px-5 pt-5", className)} {...props}>
      {children}
    </div>
  );
}

export function CardBody({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx("px-5 pb-5", className)} {...props}>
      {children}
    </div>
  );
}
