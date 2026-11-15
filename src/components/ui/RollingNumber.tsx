import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import "./RollingNumber.css";

/**
 * A count that rolls instead of swapping: only the digits that change move, upward when the number grows and downward when
 * it shrinks (even across 9 to 0), in equal-width digits so nothing beside it shifts. Screen readers get the plain number.
 * Reduced motion: the global rule turns the roll into an instant change.
 */
export function RollingNumber({ value, className }: { value: number; className?: string }) {
  const whole = Math.max(0, Math.round(value));
  const digits = String(whole).split("").map(Number);
  const previous = useRef(whole);
  const up = whole >= previous.current;
  useLayoutEffect(() => {
    previous.current = whole;
  }, [whole]);

  return (
    <span className={cn("w360-roll", className)}>
      <span className="sr-only">{whole}</span>
      <span aria-hidden className="inline-flex">
        {/* Keyed from the right, so a new leading digit (9 to 10) adds a column and the others keep theirs. */}
        {digits.map((d, i) => (
          <Digit key={digits.length - i} digit={d} up={up} />
        ))}
      </span>
    </span>
  );
}

// Each column holds three runs of 0 to 9. It rests in the middle run, so it can roll either way by up to nine places;
// after a roll it snaps back to the middle run without animating.
const RUN = 10;

function Digit({ digit, up }: { digit: number; up: boolean }) {
  const [pos, setPos] = useState(RUN + digit);
  const [snap, setSnap] = useState(false);
  // The digit this column last moved to, kept in state (not a ref) so the roll survives React's double render in development.
  const [shown, setShown] = useState(digit);

  if (digit !== shown) {
    const delta = up ? (digit - shown + RUN) % RUN : -((shown - digit + RUN) % RUN);
    setShown(digit);
    setSnap(false);
    setPos(pos + delta);
  }

  return (
    <span className="w360-roll__col">
      <span
        className="w360-roll__strip"
        data-snap={snap || undefined}
        style={{ transform: `translateY(calc(${pos} * -1.2em))` }}
        onTransitionEnd={() => {
          if (pos !== RUN + digit) {
            setSnap(true);
            setPos(RUN + digit);
          }
        }}
      >
        {Array.from({ length: RUN * 3 }, (_, i) => (
          <span key={i}>{i % RUN}</span>
        ))}
      </span>
    </span>
  );
}
