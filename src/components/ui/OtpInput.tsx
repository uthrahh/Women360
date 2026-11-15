import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { playError, playKey, playSuccess } from "@/lib/sound";
import { cn } from "@/lib/utils";
import "./OtpInput.css";

export type OtpState = "idle" | "verifying" | "error" | "success";

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Called once when all digits are in (typed, pasted or filled in by the phone or a password manager). */
  onComplete: (code: string) => void;
  state?: OtpState;
  /** Accessible name. */
  label: string;
  length?: number;
  autoFocus?: boolean;
  /** Shown under the tiles in the error state. */
  error?: string;
}

/**
 * A one-time code, entered into tiles.
 * One real input sits over the tiles, so everything that fills codes keeps working: the phone keyboard's code
 * suggestion and password managers (autocomplete="one-time-code"), pasting a whole code, and screen readers (it is one
 * labelled field). Each state shows itself: a caret on the next tile while typing, a wave while checking, a shake and a
 * cleared field when the code is wrong, and a tick when it's accepted. It submits by itself on the last digit.
 */
export function OtpInput({ value, onChange, onComplete, state = "idle", label, length = 6, autoFocus, error }: OtpInputProps) {
  const input = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const completedFor = useRef("");

  useEffect(() => {
    if (state === "error") {
      playError();
      // A wrong code is cleared so the next attempt starts fresh, after the shake has been seen.
      const t = setTimeout(() => {
        onChange("");
        completedFor.current = "";
        input.current?.focus();
      }, 650);
      return () => clearTimeout(t);
    }
    if (state === "success") playSuccess();
  }, [state, onChange]);

  function handle(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, length);
    if (digits.length > value.length) playKey();
    onChange(digits);
    if (digits.length === length && completedFor.current !== digits) {
      completedFor.current = digits;
      onComplete(digits);
    }
  }

  const active = Math.min(value.length, length - 1);
  return (
    <div className={cn("otp", `otp-${state}`)}>
      <div className="otp-glow relative rounded-3xl p-3 sm:p-4">
        <div className="relative grid gap-2 sm:gap-2.5" style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }}>
          {Array.from({ length }, (_, i) => {
            const digit = value[i];
            const isActive = focused && state === "idle" && i === active && value.length < length;
            return (
              <div
                key={i}
                aria-hidden
                className={cn("otp-tile", digit && "otp-filled", isActive && "otp-active")}
                style={{ ["--i" as string]: i }}
              >
                {digit ? <span className="otp-digit">{digit}</span> : isActive ? <span className="otp-caret" /> : null}
              </div>
            );
          })}
          <input
            ref={input}
            aria-label={label}
            aria-invalid={state === "error"}
            aria-describedby={error ? "otp-error" : undefined}
            value={value}
            onChange={(e) => handle(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            enterKeyHint="go"
            autoFocus={autoFocus}
            disabled={state === "verifying" || state === "success"}
            className="otp-input absolute inset-0 w-full h-full"
          />
        </div>
        {state === "success" && (
          <span aria-hidden className="otp-tick absolute -top-2 -right-2 grid place-items-center w-7 h-7 rounded-full bg-[var(--w360-text)] text-[var(--w360-bg)]">
            <Check size={16} strokeWidth={3} />
          </span>
        )}
      </div>
      <p role="status" className="sr-only">
        {state === "verifying" ? "Checking the code" : state === "success" ? "Code accepted" : ""}
      </p>
      {error && state === "error" && (
        <p id="otp-error" role="alert" className="text-sm text-center mt-3 text-[var(--w360-danger-text)]">
          {error}
        </p>
      )}
    </div>
  );
}
