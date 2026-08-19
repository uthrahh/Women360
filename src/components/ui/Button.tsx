import { ButtonHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg" | "xl";
  fullWidth?: boolean;
}

const variants: Record<string, string> = {
  primary: "bg-maroon-700 text-white hover:bg-maroon-800 active:bg-maroon-900 dark:bg-maroon-300 dark:text-ink-900 dark:hover:bg-maroon-200",
  secondary: "bg-transparent text-maroon-700 border border-maroon-700 hover:bg-maroon-50 dark:text-maroon-200 dark:border-maroon-300 dark:hover:bg-white/5",
  ghost: "bg-transparent text-[var(--w360-text)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]",
  danger: "bg-transparent text-red-700 border border-red-300 hover:bg-red-50 dark:text-red-300 dark:border-red-800 dark:hover:bg-red-950/40",
};

const sizes: Record<string, string> = {
  sm: "text-sm px-3 py-1.5 gap-1.5",
  md: "text-sm px-4 py-2.5 gap-2",
  lg: "text-base px-5 py-3 gap-2",
  xl: "text-lg px-6 py-4 gap-3",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", fullWidth, className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={clsx(
          "inline-flex items-center justify-center rounded font-medium transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed",
          "senior:rounded-[14px] senior:font-semibold",
          variants[variant],
          sizes[size],
          fullWidth && "w-full",
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
