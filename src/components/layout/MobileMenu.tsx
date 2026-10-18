import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { AppMenu } from "./AppMenu";

// The bottom nav only fits five destinations, so on small screens the full
// tree lives in this slide-over, opened from the top bar.
export function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  // Portalled to <body>: the top bar uses backdrop-filter, which would otherwise
  // become the containing block for this fixed panel and clip it to the bar.
  return createPortal(
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-ink-900/50" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className="absolute left-0 top-0 bottom-0 w-[18.5rem] max-w-[85vw] bg-[var(--w360-bg)] border-r border-[var(--w360-border)] shadow-float flex flex-col pt-[env(safe-area-inset-top)]"
      >
        <div className="flex items-center justify-between px-6 h-16 shrink-0">
          <Link to="/app/dashboard" onClick={onClose} className="font-display text-xl font-semibold tracking-tight">Women360</Link>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close menu"
            className="p-2 -mr-2 rounded hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto w360-scrollbar px-6 pb-8">
          <AppMenu onNavigate={onClose} />
        </div>
      </div>
    </div>,
    document.body
  );
}
