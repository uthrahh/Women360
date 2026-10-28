import { useState, type KeyboardEvent } from "react";
import clsx from "clsx";
import { StepButtons } from "@/components/ui/StepButtons";
import { useHintVisible } from "@/hooks/useHintVisible";

interface DurationFieldProps {
  label: string;
  /** Total minutes; null means "not entered", and stays that way until she enters something. */
  value: number | null;
  onChange: (minutes: number | null) => void;
  /** Most minutes allowed. */
  max?: number;
  error?: string;
  hint?: string;
  /** Where the first press of an arrow key starts, like the number fields. */
  startAtMinutes?: number;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * A duration as hours and minutes ("01 : 05"). Type digits straight in, press
 * the up and down arrow keys (Shift for bigger steps), or use the arrow buttons. The minutes roll over into
 * the hours: up from 59 goes to the next hour, down from 00 to the previous one.
 */
export function DurationField({ label, value, onChange, max = 1440, error, hint, startAtMinutes = 30 }: DurationFieldProps) {
  const hintVisible = useHintVisible(`field:${label}`);
  const hours = value === null ? null : Math.floor(value / 60);
  const minutes = value === null ? null : value % 60;
  const clamp = (total: number) => Math.max(0, Math.min(max, total));
  const commit = (total: number) => {
    const t = clamp(total);
    onChange(t > 0 ? t : null);
  };

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-sm font-medium text-[var(--w360-text)] mb-1.5">{label}</legend>
      <div
        className={clsx(
          "inline-flex items-center gap-1 self-start rounded-xl border bg-[var(--w360-bg-raised)] px-3 py-2",
          "focus-within:outline focus-within:outline-2 focus-within:outline-[var(--w360-focus)]",
          error ? "border-red-400" : "border-[var(--w360-border)]"
        )}
      >
        <Segment
          label={`${label}, hours`}
          unit="h"
          value={hours}
          max={Math.floor(max / 60)}
          disableUp={value !== null && value + 60 > max}
          disableDown={value !== null && value < 60}
          onType={(n) => commit((n ?? 0) * 60 + (minutes ?? 0))}
          onStep={(delta) => {
            if (value === null) return commit(delta > 0 ? 60 : startAtMinutes);
            commit(value + delta * 60);
          }}
        />
        <span aria-hidden className="text-lg font-medium text-[var(--w360-text-muted)]">:</span>
        <Segment
          label={`${label}, minutes`}
          unit="min"
          value={minutes}
          max={59}
          disableUp={value !== null && value + 1 > max}
          disableDown={value !== null && value < 1}
          onType={(n) => commit((hours ?? 0) * 60 + (n ?? 0))}
          // Stepping the whole duration (not just the minutes) is what makes 59 roll into the next hour.
          onStep={(delta) => {
            if (value === null) return commit(startAtMinutes);
            commit(value + delta);
          }}
        />
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      {!error && hint && hintVisible && <p className="text-xs text-[var(--w360-text-muted)]">{hint}</p>}
    </fieldset>
  );
}

function Segment({
  label,
  unit,
  value,
  max,
  disableUp,
  disableDown,
  onType,
  onStep,
}: {
  label: string;
  unit: string;
  value: number | null;
  max: number;
  disableUp?: boolean;
  disableDown?: boolean;
  onType: (n: number | null) => void;
  /** Whole steps of the segment's own unit (1, or 5 with Shift). */
  onStep: (delta: number) => void;
}) {
  // While she is typing, show exactly what she typed ("0", "05"); otherwise a tidy two digits.
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value === null ? "" : pad(value));

  const step = (direction: 1 | -1) => {
    setDraft(null);
    onStep(direction);
  };

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    const big = e.shiftKey ? 5 : 1;
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setDraft(null);
      onStep(big);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setDraft(null);
      onStep(-big);
    }
  }

  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="text"
        inputMode="numeric"
        role="spinbutton"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value ?? undefined}
        autoComplete="off"
        placeholder="--"
        value={shown}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={() => setDraft(null)}
        onKeyDown={onKey}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, 2);
          setDraft(digits);
          onType(digits === "" ? null : Math.min(max, Number(digits)));
        }}
        className="w-9 text-center text-lg font-medium tabular-nums bg-transparent outline-none senior:text-2xl senior:w-12"
      />
      <span className="text-xs text-[var(--w360-text-muted)]" aria-hidden>{unit}</span>
      <StepButtons onStep={step} label={label} disableUp={disableUp} disableDown={disableDown} />
    </span>
  );
}
