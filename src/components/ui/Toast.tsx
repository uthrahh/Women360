import { createContext, useCallback, useContext, useState, ReactNode } from "react";
import { CheckCircle2, AlertTriangle, X } from "lucide-react";

type ToastTone = "success" | "error";
interface ToastItem { id: number; message: string; tone: ToastTone; }
interface ToastContextValue { show: (message: string, options?: { tone?: ToastTone }) => void; }

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const show = useCallback((message: string, options?: { tone?: ToastTone }) => {
    const id = Date.now();
    const tone = options?.tone ?? "success";
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm">
        {toasts.map((t) => (
          <div key={t.id} role="status" className="flex items-center gap-2 bg-ink-900 text-white dark:bg-white dark:text-ink-900 px-4 py-3 rounded shadow-card text-sm">
            {t.tone === "error" ? (
              <AlertTriangle size={16} className="shrink-0 text-red-400 dark:text-red-600" />
            ) : (
              <CheckCircle2 size={16} className="shrink-0" />
            )}
            <span className="flex-1">{t.message}</span>
            <button onClick={() => setToasts((ts) => ts.filter((x) => x.id !== t.id))} aria-label="Dismiss">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
