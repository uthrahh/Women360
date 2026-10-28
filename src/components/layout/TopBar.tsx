import { Bell, Menu, Moon, Sun, UserCircle2 } from "lucide-react";
import { HelpButton } from "@/components/HelpButton";
import { Link } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/context/AppContext";
import { notificationService } from "@/services/notificationService";
import { ItemList } from "@/components/ui/ItemList";
import { MobileMenu } from "./MobileMenu";
import type { AppNotification } from "@/types";
import clsx from "clsx";

export function TopBar() {
  const { theme, senior } = useApp();
  const [notifOpen, setNotifOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
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

  function markRead(id: string) {
    notificationService.markRead(id).then(() => {
      setNotifs((list) => (list ? list.map((n) => (n.id === id ? { ...n, read: true } : n)) : list));
    });
  }

  const rows = useMemo(
    () =>
      (notifs ?? []).map((n) => ({
        id: n.id,
        title: n.title,
        description: n.detail,
        meta: n.read ? n.time : `${n.time} · unread`,
      })),
    [notifs]
  );

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-2 sm:gap-3 px-4 sm:px-6 h-16 bg-[var(--w360-bg)]/90 backdrop-blur">
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          aria-haspopup="dialog"
          className="lg:hidden p-2 -ml-2 rounded hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
        >
          <Menu size={20} />
        </button>
        <Link to="/app/dashboard" className="lg:hidden font-display text-xl font-semibold tracking-tight">Women360</Link>
      </div>
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="flex items-center gap-0.5 sm:gap-1.5">
        <button
          onClick={senior.toggleSeniorMode}
          className={clsx(
            "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap transition-colors",
            senior.seniorMode
              ? "bg-maroon-700 text-white border-maroon-700"
              : "border-[var(--w360-border)] text-[var(--w360-text-muted)] hover:text-[var(--w360-text)]"
          )}
          aria-pressed={senior.seniorMode}
          aria-label={`Senior Mode ${senior.seniorMode ? "on" : "off"}`}
        >
          <span
            aria-hidden
            className={clsx("w-1.5 h-1.5 rounded-full", senior.seniorMode ? "bg-white" : "bg-warmgrey-300")}
          />
          <span className="sm:hidden">Senior</span>
          <span className="hidden sm:inline">Senior Mode</span>
        </button>
        <HelpButton className="p-1.5 sm:p-2 rounded" />
        <button
          onClick={theme.toggle}
          aria-label="Toggle dark mode"
          className="p-1.5 sm:p-2 rounded hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
        >
          {theme.theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <div className="relative" ref={panelRef}>
          <button
            onClick={() => setNotifOpen((v) => !v)}
            aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
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
                {rows.length > 0 && (
                  <p className="text-xs text-[var(--w360-text-muted)] mt-0.5">Select one to mark it as read.</p>
                )}
              </div>
              {rows.length === 0 ? (
                <p className="px-4 py-6 text-sm text-[var(--w360-text-muted)] text-center">You're all caught up.</p>
              ) : (
                <div className="p-1">
                  <ItemList
                    ariaLabel="Notifications"
                    items={rows}
                    maxHeight={320}
                    gap={6}
                    radius={12}
                    animation="fade"
                    onItemSelect={(item) => {
                      const n = notifs?.find((x) => x.id === item.id);
                      if (n && !n.read) markRead(n.id);
                    }}
                  />
                </div>
              )}
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
