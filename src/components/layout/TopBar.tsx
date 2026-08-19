import { Bell, Moon, Sun, UserCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/context/AppContext";
import { notificationService } from "@/services/notificationService";
import type { AppNotification } from "@/mock/seed";
import clsx from "clsx";

export function TopBar() {
  const { theme, senior } = useApp();
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<AppNotification[] | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    notificationService.list().then(setNotifs);
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setNotifOpen(false);
    }
    if (notifOpen) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [notifOpen]);

  const unreadCount = notifs?.filter((n) => !n.read).length ?? 0;

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 px-4 sm:px-6 h-16 border-b border-[var(--w360-border)] bg-[var(--w360-bg)]/90 backdrop-blur">
      <Link to="/app/dashboard" className="lg:hidden font-display text-lg font-semibold">Women360</Link>
      <div className="hidden lg:block" />
      <div className="flex items-center gap-2">
        <button
          onClick={senior.toggleSeniorMode}
          className={clsx(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors",
            senior.seniorMode
              ? "bg-maroon-700 text-white border-maroon-700"
              : "border-[var(--w360-border)] text-[var(--w360-text-muted)] hover:text-[var(--w360-text)]"
          )}
          aria-pressed={senior.seniorMode}
        >
          Senior Mode {senior.seniorMode ? "On" : "Off"}
        </button>
        <button
          onClick={theme.toggle}
          aria-label="Toggle dark mode"
          className="p-2 rounded hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
        >
          {theme.theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <div className="relative" ref={panelRef}>
          <button
            onClick={() => setNotifOpen((v) => !v)}
            aria-label="Notifications"
            aria-expanded={notifOpen}
            className="p-2 rounded hover:bg-black/[0.04] dark:hover:bg-white/[0.06] relative"
          >
            <Bell size={18} />
            {unreadCount > 0 && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-maroon-600" />}
          </button>
          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 max-w-[85vw] rounded-lg border border-[var(--w360-border)] bg-[var(--w360-bg-raised)] shadow-card z-40 overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--w360-border)]">
                <p className="text-sm font-semibold">Notifications</p>
              </div>
              <div className="max-h-80 overflow-y-auto w360-scrollbar divide-y divide-[var(--w360-border)]">
                {!notifs || notifs.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-[var(--w360-text-muted)] text-center">You're all caught up.</p>
                ) : (
                  notifs.map((n) => (
                    <div key={n.id} className="px-4 py-3 flex items-start gap-2.5">
                      {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-maroon-600 mt-1.5 shrink-0" />}
                      <div className={n.read ? "pl-4" : ""}>
                        <p className="text-sm font-medium">{n.title}</p>
                        <p className="text-xs text-[var(--w360-text-muted)] mt-0.5">{n.detail}</p>
                        <p className="text-[10px] text-[var(--w360-text-muted)] mt-1">{n.time}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        <Link to="/app/settings" aria-label="Profile" className="p-1 rounded-full hover:bg-black/[0.04] dark:hover:bg-white/[0.06]">
          <UserCircle2 size={26} strokeWidth={1.5} />
        </Link>
      </div>
    </header>
  );
}
