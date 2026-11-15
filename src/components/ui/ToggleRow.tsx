import { useRef, useState } from "react";

/**
 * A switch. The knob stretches 12% along its travel while it moves, then settles back (it is a physical thing, so it has give);
 * the track changes colour with the knob. A CSS transition, so a second tap mid-way turns it round from where it is.
 */
export function ToggleRow({ title, description, checked, onChange, disabled }: { title: string; description: string; checked: boolean; onChange: () => void; disabled?: boolean }) {
  const [moving, setMoving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-[var(--w360-text-muted)] mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        disabled={disabled}
        onClick={() => {
          setMoving(true);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setMoving(false), 260);
          onChange();
        }}
        className={`w-11 h-6 rounded-full relative transition-colors duration-hover shrink-0 ${checked ? "bg-maroon-600 dark:bg-maroon-400" : "bg-warmgrey-300 dark:bg-white/15"} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white dark:bg-black transition-transform duration-popover ease-overshoot ${checked ? "translate-x-[22px]" : "translate-x-0.5"} ${checked ? "origin-right" : "origin-left"} ${moving ? "scale-x-[1.12]" : ""}`}
        />
      </button>
    </div>
  );
}
