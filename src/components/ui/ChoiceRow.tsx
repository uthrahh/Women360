import { useId } from "react";
import clsx from "clsx";

export interface Choice<T extends string | number> {
  value: T;
  label: string;
}

/**
 * One optional answer from a short list, in a single tap: tap a choice to pick it, tap it again to leave the question unanswered.
 * Unanswered is a real state here, never quietly replaced by a default.
 */
export function ChoiceRow<T extends string | number>({
  label,
  choices,
  value,
  onChange,
  note,
}: {
  label: string;
  choices: Choice<T>[];
  value: T | null | undefined;
  onChange: (value: T | null) => void;
  /** A short line under the label (plain text: use it for what she must always see). */
  note?: string;
}) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={`${id}-label`} className="flex flex-col gap-2">
      <p id={`${id}-label`} className="text-sm font-medium">
        {label} <span className="font-normal text-[var(--w360-text-muted)]">(optional)</span>
      </p>
      {note && <p className="text-xs text-[var(--w360-text-muted)] -mt-1">{note}</p>}
      <div className="flex flex-wrap gap-1.5">
        {choices.map((c) => {
          const on = value === c.value;
          return (
            <button
              key={String(c.value)}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? null : c.value)}
              className={clsx(
                "px-3 py-1.5 rounded-full border text-sm senior:text-base transition-colors",
                on
                  ? "bg-maroon-700 border-maroon-700 text-white"
                  : "border-[var(--w360-border)] text-[var(--w360-text-muted)] hover:text-[var(--w360-text)] hover:border-[var(--w360-text-muted)]"
              )}
            >
              {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
