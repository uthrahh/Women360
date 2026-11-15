import { ButtonHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg" | "xl";
  fullWidth?: boolean;
}

const variants: Record<string, string> = {
  // Black on white, white on black; hot pink is the accent on hover and focus, never the default fill.
  primary: "bg-ink-900 text-white hover:bg-maroon-700 active:bg-maroon-800 dark:bg-white dark:text-black dark:hover:bg-maroon-300 dark:active:bg-maroon-200",
  secondary: "bg-transparent text-[var(--w360-text)] border border-[var(--w360-text)] hover:border-maroon-600 hover:text-maroon-700 dark:hover:border-maroon-300 dark:hover:text-maroon-300",
  ghost: "bg-transparent text-[var(--w360-text)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]",
  danger: "bg-transparent text-red-700 border border-red-300 hover:bg-red-50 dark:text-red-300 dark:border-red-800 dark:hover:bg-red-950/40",
};

const sizes: Record<string, string> = {
  sm: "text-sm px-3 py-1.5 gap-1.5",
  md: "text-sm px-4 py-2.5 gap-2",
  lg: "text-base px-5 py-3 gap-2",
  xl: "text-lg px-6 py-4 gap-3",
};

type Variant = NonNullable<ButtonProps["variant"]>;
type Size = NonNullable<ButtonProps["size"]>;

/** The Button's look as a class string, for elements that must be a button but aren't <Button> (e.g. a popover trigger). */
export function buttonClasses({ variant = "primary", size = "md", fullWidth }: { variant?: Variant; size?: Size; fullWidth?: boolean } = {}) {
  return clsx(
    "inline-flex items-center justify-center rounded-full font-medium transition-[background-color,border-color,color,transform] duration-hover ease-enter active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed",
    // Optical centring: an icon at either end sits 2px closer to the edge, because its shape is lighter than the text beside it.
    "[&>svg:first-child:not(:only-child)]:-ml-0.5 [&>svg:last-child:not(:only-child)]:-mr-0.5",
    "senior:font-semibold",
    variants[variant],
    sizes[size],
    fullWidth && "w-full"
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", fullWidth, className, children, ...props }, ref) => {
    return (
      <button ref={ref} className={clsx(buttonClasses({ variant, size, fullWidth }), className)} {...props}>
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
