import clsx from "clsx";

export function ProgressBar({ value, tone = "accent", className }: { value: number; tone?: "accent" | "neutral"; className?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={clsx("h-2 senior:h-3 w-full rounded-full bg-warmgrey-100 dark:bg-white/10 overflow-hidden", className)}>
      <div
        className={clsx("h-full rounded-full transition-[width] duration-500", tone === "accent" ? "bg-maroon-600 dark:bg-maroon-300" : "bg-warmgrey-400")}
        style={{ width: `${pct}%` }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  );
}
