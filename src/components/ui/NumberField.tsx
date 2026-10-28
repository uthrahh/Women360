import { useEffect, useId, useRef } from "react";
import { Plus, X } from "lucide-react";
import clsx from "clsx";
import ScrubField from "@/components/reactbits/ScrubField";
import { useBrandColors } from "@/hooks/useBrandColors";
import { StepButtons } from "@/components/ui/StepButtons";
import { useHintVisible } from "@/hooks/useHintVisible";

const decimalsOf = (n: number) => {
  const [, fraction = ""] = String(n).split(".");
  return fraction.length;
};

interface NumberFieldProps {
  /** Shown inside the chip (keep it short) and read out as the field name. */
  label: string;
  /** The form value as a string; "" means "not entered". */
  value: string;
  onChange: (value: string) => void;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
  /** Where the number starts when the person first engages an empty field. */
  startAt?: number;
  /** An optional field can be cleared back to "not entered". */
  optional?: boolean;
  /** Adds a hidden input so uncontrolled <form> / FormData code keeps working. */
  name?: string;
  error?: string;
  hint?: string;
  className?: string;
}

/**
 * The app's number input: drag the chip sideways to scrub, tap to type, arrow
 * keys or the up and down arrow buttons to nudge (Shift = bigger steps, Alt = finer). An empty field stays empty
 * until the person engages it — a logged "0 g protein" is a claim, so we never
 * fill one in on their behalf.
 */
export function NumberField({
  label,
  value,
  onChange,
  suffix,
  min = 0,
  max = 1000,
  step = 1,
  startAt,
  optional,
  name,
  error,
  hint,
  className,
}: NumberFieldProps) {
  const id = useId();
  const brand = useBrandColors();
  const rootRef = useRef<HTMLDivElement>(null);
  const justEngaged = useRef(false);
  const entered = value !== "" && !Number.isNaN(Number(value));

  // After the empty chip turns into the scrubber, put the cursor in it.
  useEffect(() => {
    if (entered && justEngaged.current) {
      justEngaged.current = false;
      rootRef.current?.querySelector<HTMLInputElement>("input[role=spinbutton]")?.focus();
    }
  }, [entered]);

  function engage() {
    justEngaged.current = true;
    onChange(String(Math.min(max, Math.max(min, startAt ?? min))));
  }

  // The arrow buttons step the value by one `step`, kept to the precision of the step and the value.
  function nudge(direction: 1 | -1) {
    if (!entered) return engage();
    const current = Number(value);
    const places = Math.max(decimalsOf(step), decimalsOf(current));
    const next = Math.min(max, Math.max(min, Number((current + direction * step).toFixed(places))));
    if (next !== current) onChange(String(next));
  }

  const hintVisible = useHintVisible(`field:${label}`);
  const showHint = Boolean(hint) && hintVisible;
  const describedBy = error ? `${id}-error` : showHint ? `${id}-hint` : undefined;

  return (
    <div className={clsx("flex flex-col gap-1.5", className)} ref={rootRef}>
      <div className="flex items-center gap-2">
        {entered ? (
          <div className="flex-1 min-w-0" aria-describedby={describedBy}>
            <ScrubField
              label={label}
              suffix={suffix ?? ""}
              value={Number(value)}
              min={min}
              max={max}
              step={step}
              size="lg"
              showFill={false}
              accent={brand.accent}
              chipColor="var(--w360-bg-raised)"
              onChange={(n: number) => onChange(String(n))}
              className={clsx(
                "!w-full border text-[var(--w360-text)] focus-within:ring-2 focus-within:ring-[var(--w360-focus)]",
                error ? "border-red-400" : "border-[var(--w360-border)]"
              )}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={engage}
            aria-describedby={describedBy}
            className={clsx(
              "flex-1 min-w-0 h-11 px-4 rounded-[10px] border border-dashed text-sm text-left flex items-center gap-2 transition-colors",
              "bg-transparent text-[var(--w360-text-muted)] hover:text-[var(--w360-text)] hover:border-maroon-400",
              error ? "border-red-400" : "border-[var(--w360-border)]"
            )}
          >
            <Plus size={14} aria-hidden />
            <span>
              {optional ? "Add" : "Enter"} {label.toLowerCase()}
              {suffix ? ` (${suffix})` : ""}
            </span>
          </button>
        )}
        <StepButtons
          onStep={nudge}
          label={label}
          disableUp={entered && Number(value) >= max}
          disableDown={entered && Number(value) <= min}
        />
        {optional && entered && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label={`Clear ${label.toLowerCase()}`}
            className="shrink-0 p-2 rounded-full text-[var(--w360-text-muted)] hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
          >
            <X size={16} />
          </button>
        )}
      </div>
      {name && <input type="hidden" name={name} value={entered ? value : ""} />}
      {error && (
        <p id={`${id}-error`} className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {!error && showHint && (
        <p id={`${id}-hint`} className="text-xs text-[var(--w360-text-muted)]">
          {hint}
        </p>
      )}
    </div>
  );
}
