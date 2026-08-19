import { InputHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const inputId = id || props.name;
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-[var(--w360-text)]">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={clsx(
            "px-3.5 py-2.5 rounded border bg-[var(--w360-bg-raised)] text-[var(--w360-text)] text-sm",
            "placeholder:text-[var(--w360-text-muted)]",
            "senior:text-lg senior:py-3.5 senior:rounded-[10px]",
            error ? "border-red-400" : "border-[var(--w360-border)]",
            className
          )}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          {...props}
        />
        {error && (
          <p id={`${inputId}-error`} className="text-xs text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        {!error && hint && (
          <p id={`${inputId}-hint`} className="text-xs text-[var(--w360-text-muted)]">
            {hint}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";
