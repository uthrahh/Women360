import { useId } from "react";
import clsx from "clsx";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

/**
 * A required choice from two to four short options: one is always selected. Native radio inputs under the buttons, so the arrow keys,
 * the screen reader's "1 of 2" and form behaviour come for free. (For an optional answer use ChoiceRow; for a long list a select.)
 */
export function SegmentedChoice<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  const name = useId();
  return (
    <fieldset className="flex flex-col gap-1.5 min-w-0">
      <legend className="text-sm font-medium senior:text-lg mb-1.5">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = o.value === value;
          return (
            <label
              key={o.value}
              className={clsx(
                "cursor-pointer px-3.5 py-2 rounded border text-sm senior:text-lg transition-colors duration-150 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--w360-focus)]",
                on
                  ? "border-maroon-600 bg-maroon-50 text-maroon-800 dark:bg-maroon-950/40 dark:text-maroon-200 dark:border-maroon-400"
                  : "border-[var(--w360-border)] hover:border-maroon-400"
              )}
            >
              <input type="radio" name={name} value={o.value} checked={on} onChange={() => onChange(o.value)} className="sr-only" />
              {o.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
