import { PointerEvent as ReactPointerEvent, ReactNode, useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import clsx from "clsx";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// On a phone the dialog is a bottom sheet (below Tailwind's `sm`); it can be pulled down to dismiss.
const SHEET_QUERY = "(max-width: 639px)";
const DISMISS_DISTANCE = 120; // px pulled down
const FLICK_SPEED = 0.6; // px per ms, with at least FLICK_MIN px of travel
const FLICK_MIN = 40;

/** The vertical offset the sheet is at right now (it may be part-way through an animation). */
function currentOffsetY(el: HTMLElement): number {
  const transform = getComputedStyle(el).transform;
  return transform && transform !== "none" ? new DOMMatrixReadOnly(transform).m42 : 0;
}

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
  const scrimRef = useRef<HTMLDivElement>(null);
  // Always call the newest onClose without restarting the effects below (an unstable function would otherwise
  // move focus back to the first field on every keystroke).
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // The history entry this dialog owns, so the phone's Back button (and Android's back gesture, with its preview) closes the dialog
  // instead of leaving the screen. It survives React running effects twice in development: the entry is only added once, and only
  // removed after a beat if nothing re-claimed it.
  const entryToken = useRef(`w360-modal-${Math.random().toString(36).slice(2)}`);
  const pendingBack = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!open) return;
    const token = entryToken.current;
    clearTimeout(pendingBack.current);
    if (window.history.state?.w360Modal !== token) {
      // Keep the router's own bookkeeping (idx) on the entry we add.
      window.history.pushState({ ...(window.history.state ?? {}), w360Modal: token }, "");
    }
    const onPop = () => {
      if (window.history.state?.w360Modal !== token) closeRef.current();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      pendingBack.current = setTimeout(() => {
        if (window.history.state?.w360Modal === token) window.history.back();
      }, 0);
    };
  }, [open]);

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

    // Slide up into place on a phone (a CSS transition, so a touch during it simply takes over).
    if (window.matchMedia(SHEET_QUERY).matches) {
      dialog.style.transform = "translateY(100%)";
      dialog.getBoundingClientRect();
      dialog.style.transform = "";
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

  // ---- pulling the sheet down ----
  const drag = useRef<{ id: number; startY: number; base: number; lastY: number; lastT: number; speed: number } | null>(null);

  function setOffset(dialog: HTMLElement, y: number) {
    dialog.style.transform = y > 0 ? `translateY(${y}px)` : "";
    // The dimmed page behind fades as the sheet goes.
    if (scrimRef.current) scrimRef.current.style.opacity = String(Math.max(0, 1 - y / Math.max(dialog.offsetHeight, 1)));
  }

  function onHandleDown(e: ReactPointerEvent<HTMLDivElement>) {
    const dialog = dialogRef.current;
    if (!dialog || !window.matchMedia(SHEET_QUERY).matches) return;
    if ((e.target as Element).closest("button, a, input, select, textarea")) return;
    // Pointer capture "locks" the gesture to the handle: it keeps following the finger even when it slides off the handle.
    e.currentTarget.setPointerCapture(e.pointerId);
    // Start from wherever the sheet is right now, so grabbing it mid-animation doesn't make it jump.
    const base = currentOffsetY(dialog);
    dialog.dataset.dragging = "true";
    setOffset(dialog, base);
    drag.current = { id: e.pointerId, startY: e.clientY, base, lastY: e.clientY, lastT: e.timeStamp, speed: 0 };
  }

  function onHandleMove(e: ReactPointerEvent<HTMLDivElement>) {
    const d = drag.current;
    const dialog = dialogRef.current;
    if (!d || !dialog || e.pointerId !== d.id) return;
    const dt = Math.max(e.timeStamp - d.lastT, 1);
    d.speed = (e.clientY - d.lastY) / dt;
    d.lastY = e.clientY;
    d.lastT = e.timeStamp;
    // Following the finger down; pulling up is resisted instead of letting the sheet float away from the bottom.
    const raw = d.base + (e.clientY - d.startY);
    setOffset(dialog, raw >= 0 ? raw : raw / 4);
  }

  function onHandleUp(e: ReactPointerEvent<HTMLDivElement>) {
    const d = drag.current;
    const dialog = dialogRef.current;
    if (!d || !dialog || e.pointerId !== d.id) return;
    drag.current = null;
    delete dialog.dataset.dragging;
    const y = currentOffsetY(dialog);
    if (y > DISMISS_DISTANCE || (d.speed > FLICK_SPEED && y > FLICK_MIN)) {
      // Carry on off the bottom of the screen, then close.
      dialog.style.transform = "translateY(100%)";
      if (scrimRef.current) scrimRef.current.style.opacity = "0";
      setTimeout(() => closeRef.current(), 200);
    } else {
      setOffset(dialog, 0); // spring back
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div ref={scrimRef} className="absolute inset-0 bg-ink-900/50 backdrop-blur-[1px]" onClick={onClose} aria-hidden />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={clsx(
          "w360-sheet relative bg-[var(--w360-bg-raised)] w-full sm:rounded-[28px] rounded-t-[28px] shadow-card border border-[var(--w360-border)] max-h-[88vh] overflow-y-auto w360-scrollbar outline-none",
          size === "sm" && "sm:max-w-sm",
          size === "md" && "sm:max-w-lg",
          size === "lg" && "sm:max-w-2xl"
        )}
      >
        {/* The part you can pull on (on a phone): a small handle above the title. */}
        <div
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleUp}
          style={{ touchAction: "none" }}
          className="sticky top-0 bg-[var(--w360-bg-raised)] border-b border-[var(--w360-border)] sm:touch-auto"
        >
          <div aria-hidden className="sm:hidden mx-auto mt-2 h-1.5 w-10 rounded-full bg-[var(--w360-border)]" />
          <div className="flex items-center justify-between px-5 py-4">
            <h2 id={titleId} className="font-display text-lg senior:text-2xl font-semibold">
              {title}
            </h2>
            <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded hover:bg-black/[0.05] dark:hover:bg-white/[0.08]">
              <X size={20} />
            </button>
          </div>
        </div>
        <div className="p-5 pb-[calc(1.25rem+var(--safe-bottom))]" data-modal-body>{children}</div>
      </div>
    </div>
  );
}
