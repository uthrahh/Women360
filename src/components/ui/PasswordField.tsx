import { useId, useState } from "react";
import { Check, Circle, Eye, EyeOff } from "lucide-react";
import clsx from "clsx";
import { checkPassword, type PasswordContext } from "@/lib/passwordPolicy";

interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  required?: boolean;
  // "new-password" lets password managers offer to generate one.
  autoComplete?: "new-password" | "current-password";
  // Live checklist of the rules, for choosing a new password. Omit for sign-in.
  policyContext?: PasswordContext;
}

export function PasswordField({
  label,
  value,
  onChange,
  error,
  hint,
  required,
  autoComplete = "current-password",
  policyContext,
}: PasswordFieldProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const checks = policyContext ? checkPassword(value, policyContext) : null;

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
          aria-describedby={error ? `${id}-error` : checks ? `${id}-rules` : hint ? `${id}-hint` : undefined}
          className={clsx(
            "w-full pl-4 pr-12 py-3 rounded-xl border bg-[var(--w360-bg-raised)] text-[var(--w360-text)] text-sm",
            "senior:text-lg senior:py-3.5 senior:rounded-2xl",
            error ? "border-red-400" : "border-[var(--w360-border)]"
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
      {error && <p id={`${id}-error`} className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      {checks && (
        <ul id={`${id}-rules`} className="flex flex-col gap-1 mt-0.5" aria-live="polite">
          {checks.map((c) => (
            <li
              key={c.id}
              className={clsx(
                "flex items-center gap-2 text-xs senior:text-base",
                c.ok && value ? "text-emerald-700 dark:text-emerald-400" : "text-[var(--w360-text-muted)]"
              )}
            >
              {c.ok && value ? <Check size={13} aria-hidden /> : <Circle size={13} aria-hidden />}
              <span>
                {c.label}
                <span className="sr-only">{c.ok && value ? " — met" : " — not yet met"}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {!error && !checks && hint && <p id={`${id}-hint`} className="text-xs text-[var(--w360-text-muted)]">{hint}</p>}
    </div>
  );
}
