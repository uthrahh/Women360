import { useEffect, useRef, type PointerEvent } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import clsx from "clsx";

interface StepButtonsProps {
  /** Called once per step: +1 for the up arrow, -1 for the down arrow. */
  onStep: (direction: 1 | -1) => void;
  /** What the pair changes, read out by screen readers ("Duration, minutes"). */
  label: string;
  disableUp?: boolean;
  disableDown?: boolean;
  className?: string;
}

const HOLD_DELAY_MS = 400;
const REPEAT_MS = 80;

/**
 * Up and down arrows for a number field: a click steps once, holding the button
 * keeps stepping. They are a pointer and touch aid only. The field itself is a
 * spinbutton that already takes the arrow keys, so these stay out of the tab
 * order (a keyboard user would otherwise tab through two extra stops per field).
 */
export function StepButtons({ onStep, label, disableUp, disableDown, className }: StepButtonsProps) {
  const timers = useRef<{ delay?: number; repeat?: number }>({});
  // A hold keeps calling the latest handler, so a long press doesn't step from a stale value.
  const latest = useRef(onStep);
  latest.current = onStep;

  function stop() {
    window.clearTimeout(timers.current.delay);
    window.clearInterval(timers.current.repeat);
    timers.current = {};
  }
  useEffect(() => stop, []);

  function press(direction: 1 | -1) {
    return (e: PointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0) return;
      stop();
      latest.current(direction);
      timers.current.delay = window.setTimeout(() => {
        timers.current.repeat = window.setInterval(() => latest.current(direction), REPEAT_MS);
      }, HOLD_DELAY_MS);
    };
  }

  const button = (direction: 1 | -1, disabled?: boolean) => (
    <button
      type="button"
      tabIndex={-1}
      disabled={disabled}
      aria-label={`${direction === 1 ? "Increase" : "Decrease"} ${label.toLowerCase()}`}
      onPointerDown={press(direction)}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onBlur={stop}
      // Pointer presses are handled above; a click with no pointer (a screen reader's "activate") steps once.
      onClick={(e) => {
        if (e.detail === 0) latest.current(direction);
      }}
      onContextMenu={(e) => e.preventDefault()}
      className={clsx(
        "flex items-center justify-center w-10 h-6 senior:w-12 senior:h-7 select-none touch-manipulation",
        "text-[var(--w360-text-muted)] transition-colors",
        "hover:text-[var(--w360-text)] hover:bg-black/[0.05] dark:hover:bg-white/[0.08] active:bg-black/[0.1] dark:active:bg-white/[0.14]",
        "disabled:opacity-30 disabled:pointer-events-none",
        direction === 1 ? "rounded-t-lg" : "rounded-b-lg"
      )}
    >
      {direction === 1 ? <ChevronUp size={16} aria-hidden /> : <ChevronDown size={16} aria-hidden />}
    </button>
  );

  return (
    <div className={clsx("shrink-0 flex flex-col", className)}>
      {button(1, disableUp)}
      {button(-1, disableDown)}
    </div>
  );
}
