import { ReactNode } from "react";
import { Inbox, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "./Button";

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 gap-3 text-[var(--w360-text-muted)]" role="status" aria-live="polite">
      <Loader2 className="animate-spin" size={26} />
      <p className="text-sm">{label}…</p>
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
      <h3 className="font-display text-lg senior:text-2xl font-semibold">{title}</h3>
      {description && <p className="text-sm senior:text-base text-[var(--w360-text-muted)] max-w-sm">{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ title = "Something didn't load", description, onRetry }: { title?: string; description?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6 gap-3">
      <div className="text-red-500"><AlertTriangle size={28} /></div>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {description && <p className="text-sm text-[var(--w360-text-muted)] max-w-sm">{description}</p>}
      {onRetry && <Button variant="secondary" size="sm" onClick={onRetry}>Try again</Button>}
    </div>
  );
}
