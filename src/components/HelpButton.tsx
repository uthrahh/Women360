import { CircleHelp } from "lucide-react";
import clsx from "clsx";
import { useTips } from "@/context/TipsContext";

/** Brings the instructions back for the screen she is on. They go away again when she moves on. */
export function HelpButton({ className, size = 18 }: { className?: string; size?: number }) {
  const { tipsOn, toggleTips } = useTips();
  return (
    <button
      type="button"
      onClick={toggleTips}
      aria-pressed={tipsOn}
      aria-label="Show tips for this page"
      title="Show tips for this page"
      className={clsx(
        "rounded-full transition-colors hover:bg-black/[0.05] dark:hover:bg-white/[0.08]",
        tipsOn && "bg-[var(--w360-tint)] text-maroon-700 dark:text-maroon-200",
        className ?? "p-2"
      )}
    >
      <CircleHelp size={size} aria-hidden />
    </button>
  );
}
