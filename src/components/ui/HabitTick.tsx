import { useEffect, useRef, useState } from "react";
import { Check, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import "./HabitTick.css";

interface HabitTickProps {
  done: boolean;
  /** Called at once with the new state; the screen has already changed (optimistic), so there is no spinner. */
  onChange: (done: boolean) => void;
  /** The accessible name, e.g. "Take my vitamin". */
  label: string;
  size?: number;
}

/**
 * The daily tick. Not done: an empty ring, the quiet state. Done: filled, the only filled thing on the card, so the day's
 * progress reads at a glance. Press shrinks it a little; letting go springs it past full size and settles it; a ring of
 * light pulses out once to confirm; the flame turns into the check (a cross-fade with scale and blur). Un-ticking is quicker
 * and doesn't overshoot. It is a CSS transition, so tapping again mid-way turns it round from where it is.
 */
export function HabitTick({ done, onChange, label, size = 44 }: HabitTickProps) {
  const [pulse, setPulse] = useState(0);
  const was = useRef(done);
  useEffect(() => {
    if (done && !was.current) setPulse((n) => n + 1);
    was.current = done;
  }, [done]);

  return (
    <button
      type="button"
      aria-pressed={done}
      aria-label={label}
      onClick={() => onChange(!done)}
      className={cn("w360-tick", done && "w360-tick--done")}
      style={{ width: size, height: size }}
    >
      {pulse > 0 && done && <span key={pulse} aria-hidden className="w360-tick__pulse" />}
      <span aria-hidden className="w360-tick__fill" />
      <Flame aria-hidden className="w360-tick__icon w360-tick__flame" size={size * 0.46} strokeWidth={1.8} />
      <Check aria-hidden className="w360-tick__icon w360-tick__check" size={size * 0.5} strokeWidth={3} />
    </button>
  );
}
