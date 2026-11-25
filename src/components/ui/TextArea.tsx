import { forwardRef, useId, type TextareaHTMLAttributes } from "react";
import clsx from "clsx";

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  /** Shown as "(optional)" after the label. */
  optional?: boolean;
  error?: string;
  /** A plain line under the label that she must always see (not an instruction: use a Hint for those). */
  note?: string;
}

/** A labelled multi-line text field, styled like `Input`. The label is always tied to the field and the error is announced with it. */
export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(({ label, optional, error, note, className, id, rows = 3, ...props }, ref) => {
  const generated = useId();
  const fieldId = id || generated;
  const described = [error ? `${fieldId}-error` : null, note ? `${fieldId}-note` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <label htmlFor={fieldId} className="text-sm font-medium text-[var(--w360-text)] senior:text-lg">
        {label} {optional && <span className="font-normal text-[var(--w360-text-muted)]">(optional)</span>}
      </label>
      {note && (
        <p id={`${fieldId}-note`} className="text-xs text-[var(--w360-text-muted)] -mt-0.5">
          {note}
        </p>
      )}
      <textarea
        ref={ref}
        id={fieldId}
        rows={rows}
        className={clsx(
          "px-4 py-3 rounded-xl border bg-[var(--w360-bg-raised)] text-[var(--w360-text)] text-sm resize-y",
          "placeholder:text-[var(--w360-text-muted)] senior:text-lg senior:rounded-2xl",
          error ? "border-red-400" : "border-[var(--w360-border)]",
          className
        )}
        aria-invalid={!!error}
        aria-describedby={described}
        {...props}
      />
      {error && (
        <p id={`${fieldId}-error`} className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
});
TextArea.displayName = "TextArea";
