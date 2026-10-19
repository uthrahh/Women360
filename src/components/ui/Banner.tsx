import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type BannerTone = "info" | "success" | "warning" | "danger";

const ICON = { info: Info, success: CheckCircle2, warning: AlertTriangle, danger: XCircle } as const;

// Colours come from the --w360-<tone>-* tokens in index.css (light and dark),
// not from raw Tailwind palette classes.
const TONE: Record<BannerTone, string> = {
  info: "bg-[var(--w360-info-bg)] border-[var(--w360-info-border)] text-[var(--w360-info-text)]",
  success: "bg-[var(--w360-success-bg)] border-[var(--w360-success-border)] text-[var(--w360-success-text)]",
  warning: "bg-[var(--w360-warning-bg)] border-[var(--w360-warning-border)] text-[var(--w360-warning-text)]",
  danger: "bg-[var(--w360-danger-bg)] border-[var(--w360-danger-border)] text-[var(--w360-danger-text)]",
};

interface BannerProps {
  tone?: BannerTone;
  title?: string;
  children?: ReactNode;
  /** A single follow-up, e.g. a "Try again" button or link. */
  action?: ReactNode;
  /** Shows a dismiss button when given. */
  onDismiss?: () => void;
  className?: string;
}

/**
 * An inline status message that sits in the page flow: something she should
 * know (info), that worked (success), that needs care (warning) or that failed
 * (danger). Warnings and errors are announced straight away; info and success
 * wait for a pause in speech. It never floats or covers content, so use Toast
 * for something that confirms an action and then goes away.
 */
export function Banner({ tone = "info", title, children, action, onDismiss, className }: BannerProps) {
  const Icon = ICON[tone];
  return (
    <div
      role={tone === "warning" || tone === "danger" ? "alert" : "status"}
      className={cn("flex items-start gap-3 rounded-lg border px-4 py-3 text-sm senior:text-base", TONE[tone], className)}
    >
      <Icon size={18} strokeWidth={1.9} className="mt-0.5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 flex flex-col gap-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className="leading-relaxed">{children}</div>}
        {action && <div className="mt-1">{action}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 -mr-1 -mt-0.5 p-1 rounded opacity-70 hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--w360-focus)]"
        >
          <X size={16} aria-hidden />
        </button>
      )}
    </div>
  );
}
