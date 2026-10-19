import type { ReactNode } from "react";
import type { Variants } from "motion/react";
import { X } from "lucide-react";
import { MorphingPopover, MorphingPopoverContent, MorphingPopoverTrigger } from "./MorphingPopover";
import { buttonClasses } from "./Button";

const VARIANTS: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

/**
 * Where a new entry is logged: a button that grows into the form (and folds
 * back when it closes). The page owns `open`, so other entry points on the
 * same page (a template chip, an empty-state button) can open it too; it grows
 * from this button either way. Editing an existing entry stays in a Modal.
 */
export function LogPopover({
  open,
  onOpenChange,
  triggerLabel,
  triggerIcon,
  triggerVariant = "primary",
  title,
  children,
  className = "",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerLabel: string;
  triggerIcon?: ReactNode;
  triggerVariant?: "primary" | "secondary";
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <MorphingPopover open={open} onOpenChange={onOpenChange} variants={VARIANTS}>
      <MorphingPopoverTrigger className={buttonClasses({ variant: triggerVariant, size: triggerVariant === "secondary" ? "sm" : "md" })}>
        {triggerIcon}
        {triggerLabel}
      </MorphingPopoverTrigger>
      <MorphingPopoverContent title={title} className={`sm:w-[26rem] ${className}`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--w360-border)] sticky top-0 z-10 bg-[var(--w360-bg-raised)]">
          <h2 className="font-display text-lg senior:text-2xl font-semibold">{title}</h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            className="p-1.5 rounded hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </MorphingPopoverContent>
    </MorphingPopover>
  );
}
