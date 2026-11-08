import clsx from "clsx";

/** A calm placeholder block for content that is on its way. It shimmers (and sits still for anyone who prefers reduced motion). */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={clsx("w360-skeleton rounded-md", className)} />;
}

/** Lines of text of slightly different lengths, so it reads as text and not as a bar. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  const widths = ["w-full", "w-11/12", "w-4/5", "w-2/3"];
  return (
    <div aria-hidden className={clsx("flex flex-col gap-2.5", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={clsx("h-3.5", widths[i % widths.length])} />
      ))}
    </div>
  );
}

/** A card-shaped placeholder: a heading, a few lines, so the page doesn't jump when the real card arrives. */
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div aria-hidden className="rounded-[var(--w360-radius-card)] border border-[var(--w360-border)] bg-[var(--w360-bg-raised)] p-5">
      <Skeleton className="h-5 w-1/3 mb-4" />
      <SkeletonText lines={lines} />
    </div>
  );
}

/** A list of rows (habits, entries, appointments). */
export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-hidden className="flex flex-col gap-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border border-[var(--w360-border)] bg-[var(--w360-bg-raised)] p-4">
          <Skeleton className="h-9 w-9 rounded-full shrink-0" />
          <div className="flex-1">
            <Skeleton className="h-4 w-2/5 mb-2" />
            <Skeleton className="h-3 w-3/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** A whole screen while its first data loads: a title, then a few cards. */
export function PageSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-5 max-w-2xl">
      <div>
        <Skeleton className="h-8 w-48 mb-3" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <SkeletonCard lines={3} />
      <SkeletonCard lines={2} />
      <SkeletonRows rows={2} />
    </div>
  );
}
