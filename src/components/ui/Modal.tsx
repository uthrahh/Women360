import { ReactNode, useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import clsx from "clsx";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  // Always call the newest onClose without restarting the effect below (an unstable function would otherwise
  // move focus back to the first field on every keystroke).
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    // Remember what had focus so it can go back there, put focus inside the dialog (unless a field already took it),
    // and stop the page behind from scrolling.
    const opener = document.activeElement as HTMLElement | null;
    const scrollBefore = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (!dialog.contains(document.activeElement)) {
      const body = dialog.querySelector<HTMLElement>(`[data-modal-body] :is(${FOCUSABLE})`);
      (body ?? dialog.querySelector<HTMLElement>(FOCUSABLE) ?? dialog).focus({ preventScroll: true });
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key !== "Tab" || !dialog) return;
      // Keep Tab inside the dialog: from the last control it wraps to the first, and Shift+Tab the other way.
      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (items.length === 0) {
        e.preventDefault();
        dialog.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = scrollBefore;
      // Back to the control that opened it, if it is still on the page.
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-ink-900/50 backdrop-blur-[1px]" onClick={onClose} aria-hidden />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={clsx(
          "relative bg-[var(--w360-bg-raised)] w-full sm:rounded-[28px] rounded-t-[28px] shadow-card border border-[var(--w360-border)] max-h-[88vh] overflow-y-auto w360-scrollbar outline-none",
          size === "sm" && "sm:max-w-sm",
          size === "md" && "sm:max-w-lg",
          size === "lg" && "sm:max-w-2xl"
        )}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--w360-border)] sticky top-0 bg-[var(--w360-bg-raised)]">
          <h2 id={titleId} className="font-display text-lg senior:text-2xl font-semibold">
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded hover:bg-black/[0.05] dark:hover:bg-white/[0.08]">
            <X size={20} />
          </button>
        </div>
        <div className="p-5" data-modal-body>{children}</div>
      </div>
    </div>
  );
}
