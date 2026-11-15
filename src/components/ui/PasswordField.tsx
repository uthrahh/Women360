import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import clsx from "clsx";

interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  required?: boolean;
  // Entering an existing password. Choosing a new one uses NewPasswordField.
  autoComplete?: "current-password";
}

export function PasswordField({
  label,
  value,
  onChange,
  error,
  hint,
  required,
  autoComplete = "current-password",
}: PasswordFieldProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-[var(--w360-text)]">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          autoComplete={autoComplete}
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={clsx(
            "w-full pl-4 pr-12 py-3 rounded-xl border bg-[var(--w360-bg-raised)] text-[var(--w360-text)] text-sm",
            "senior:text-lg senior:py-3.5 senior:rounded-2xl",
            error ? "border-[var(--w360-danger-border)]" : "border-[var(--w360-border)]"
          )}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 px-3.5 text-[var(--w360-text-muted)] hover:text-[var(--w360-text)]"
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {error && <p id={`${id}-error`} className="text-xs text-[var(--w360-danger-text)]">{error}</p>}
      {!error && hint && <p id={`${id}-hint`} className="text-xs text-[var(--w360-text-muted)]">{hint}</p>}
    </div>
  );
}
