import type { ReactNode } from "react";

/** A keyboard key, drawn as a key: for shortcut hints. */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[1.4rem] items-center justify-center rounded border border-[var(--w360-border)] bg-[var(--w360-bg)] px-1.5 py-0.5 font-sans text-[0.7rem] font-medium leading-none text-[var(--w360-text-muted)] shadow-[0_1px_0_var(--w360-border)]">
      {children}
    </kbd>
  );
}
