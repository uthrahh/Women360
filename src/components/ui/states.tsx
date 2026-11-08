import { ReactNode } from "react";
import { Inbox, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "./Button";
import { PageSkeleton, SkeletonRows } from "./Skeleton";

/**
 * What a screen shows while its first data loads. By default a skeleton of the page (so the layout doesn't jump when the real
 * content arrives); "rows" for a list and "spinner" for a small inline wait. The words stay for screen readers and tests.
 */
export function LoadingState({ label = "Loading", variant = "page" }: { label?: string; variant?: "page" | "rows" | "spinner" }) {
  if (variant === "spinner") {
    return (
      <div className="flex flex-col items-center justify-center py-14 gap-3 text-[var(--w360-text-muted)]" role="status" aria-live="polite">
        <Loader2 className="animate-spin" size={26} />
        <p className="text-sm">{label}…</p>
      </div>
    );
  }
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <p className="sr-only">{label}…</p>
      {variant === "rows" ? <SkeletonRows /> : <PageSkeleton />}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6 gap-3">
      <div className="text-warmgrey-400">{icon ?? <Inbox size={30} />}</div>
      <h2 className="font-display text-lg senior:text-2xl font-semibold">{title}</h2>
      {description && <p className="text-sm senior:text-base text-[var(--w360-text-muted)] max-w-sm">{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ title = "Something didn't load", description, onRetry }: { title?: string; description?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6 gap-3">
      <div className="text-red-500"><AlertTriangle size={28} /></div>
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {description && <p className="text-sm text-[var(--w360-text-muted)] max-w-sm">{description}</p>}
      {onRetry && <Button variant="secondary" size="sm" onClick={onRetry}>Try again</Button>}
    </div>
  );
}
