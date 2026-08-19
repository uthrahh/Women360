import { ReactNode, useEffect } from "react";
import { X } from "lucide-react";
import clsx from "clsx";

export function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-ink-900/50 backdrop-blur-[1px]" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={clsx(
          "relative bg-[var(--w360-bg-raised)] w-full sm:rounded-lg rounded-t-lg shadow-card border border-[var(--w360-border)] max-h-[88vh] overflow-y-auto w360-scrollbar",
          size === "sm" && "sm:max-w-sm",
          size === "md" && "sm:max-w-lg",
          size === "lg" && "sm:max-w-2xl"
        )}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--w360-border)] sticky top-0 bg-[var(--w360-bg-raised)]">
          <h2 id="modal-title" className="font-display text-lg senior:text-2xl font-semibold">
            {title}
          </h2>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded hover:bg-black/[0.05] dark:hover:bg-white/[0.08]">
            <X size={20} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
