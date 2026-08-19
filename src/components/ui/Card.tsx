import { HTMLAttributes } from "react";
import clsx from "clsx";

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "bg-[var(--w360-bg-raised)] border border-[var(--w360-border)] rounded-[var(--w360-radius-card)]",
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
