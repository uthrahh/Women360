import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { CheckCircle2, AlertTriangle, X } from "lucide-react";

type ToastTone = "success" | "error";
/** A button on the message, such as "Undo". Pressing it runs onClick and dismisses the message. */
export interface ToastAction { label: string; onClick: () => void }
interface ToastItem { id: number; message: string; tone: ToastTone; action?: ToastAction; }
interface ToastContextValue { show: (message: string, options?: { tone?: ToastTone; action?: ToastAction }) => void; }

const ToastContext = createContext<ToastContextValue | null>(null);

// How long a message stays. An error explains something that went wrong and has to be read, so it stays much
// longer than a confirmation, and both stay until dismissed if the pointer or keyboard focus is on them.
const SHOW_MS: Record<ToastTone, number> = { success: 4000, error: 9000 };
// A message with an action ("Undo") needs time to be noticed and used.
const ACTION_MS = 8000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  // The list also lives in a ref so show/dismiss can read it without doing side effects inside a state updater.
  const listRef = useRef<ToastItem[]>([]);
  const publish = (next: ToastItem[]) => {
    listRef.current = next;
    setToasts(next);
  };
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    publish(listRef.current.filter((x) => x.id !== id));
  }, []);

  const arm = useCallback((id: number, tone: ToastTone) => {
    clearTimeout(timers.current.get(id));
    const hasAction = Boolean(listRef.current.find((t) => t.id === id)?.action);
    timers.current.set(id, setTimeout(() => dismiss(id), hasAction ? Math.max(ACTION_MS, SHOW_MS[tone]) : SHOW_MS[tone]));
  }, [dismiss]);

  const show = useCallback((message: string, options?: { tone?: ToastTone; action?: ToastAction }) => {
    const tone = options?.tone ?? "success";
    const action = options?.action;
    // The same message again (a double tap, or a repeated reminder) renews the one already shown instead of stacking a copy.
    // (A message with an action is never merged: its action belongs to this particular thing.)
    const existing = action ? undefined : listRef.current.find((t) => t.message === message && t.tone === tone && !t.action);
    if (existing) {
      arm(existing.id, tone);
      return;
    }
    const id = nextId.current++;
    publish([...listRef.current, { id, message, tone, action }]);
    arm(id, tone);
  }, [arm]);

  useEffect(() => {
    const live = timers.current;
    return () => live.forEach((t) => clearTimeout(t));
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {/* The live region is always on the page, so messages added to it are announced by screen readers. */}
      <div
        aria-live="polite"
        aria-relevant="additions"
        style={{ bottom: "calc(var(--toast-offset, 1.5rem) + var(--safe-bottom))" }}
        className="[--toast-offset:5rem] sm:[--toast-offset:1.5rem] fixed left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            onMouseEnter={() => clearTimeout(timers.current.get(t.id))}
            onMouseLeave={() => arm(t.id, t.tone)}
            onFocus={() => clearTimeout(timers.current.get(t.id))}
            onBlur={() => arm(t.id, t.tone)}
            className="flex items-center gap-2 bg-ink-900 text-white dark:bg-white dark:text-ink-900 px-4 py-3 rounded shadow-card text-sm"
          >
            {t.tone === "error" ? (
              <AlertTriangle size={16} className="shrink-0 text-red-400 dark:text-red-600" />
            ) : (
              <CheckCircle2 size={16} className="shrink-0" />
            )}
            <span className="flex-1">{t.message}</span>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action?.onClick();
                  dismiss(t.id);
                }}
                className="shrink-0 font-semibold underline underline-offset-2 px-1 py-0.5 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--w360-focus)]"
              >
                {t.action.label}
              </button>
            )}
            <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="p-1 -m-1 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--w360-focus)]">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
