import { NavLink, useNavigate } from "react-router-dom";
import { Sun, Moon, Settings as SettingsIcon, ArrowLeft } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { seniorNavMap } from "@/config/navigation";
import { Link, useLocation } from "react-router-dom";

export function SeniorTopBar({ title }: { title?: string }) {
  const { theme, senior } = useApp();
  const nav = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === "/app/dashboard";

  return (
    <header className="flex items-center justify-between px-5 h-20 border-b border-[var(--w360-border)] bg-[var(--w360-bg)]">
      <div className="flex items-center gap-3">
        {!isHome && (
          <button onClick={() => nav(-1)} aria-label="Go back" className="p-2 rounded-full hover:bg-black/[0.05] dark:hover:bg-white/[0.08]">
            <ArrowLeft size={26} />
          </button>
        )}
        <span className="font-display text-2xl font-semibold">{title ?? "MY HEALTH"}</span>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={theme.toggle} aria-label="Toggle dark mode" className="p-2.5 rounded-full hover:bg-black/[0.05] dark:hover:bg-white/[0.08]">
          {theme.theme === "dark" ? <Sun size={24} /> : <Moon size={24} />}
        </button>
        <Link to="/app/settings" aria-label="Settings" className="p-2.5 rounded-full hover:bg-black/[0.05] dark:hover:bg-white/[0.08]">
          <SettingsIcon size={24} />
        </Link>
        <button
          onClick={senior.toggleSeniorMode}
          className="ml-1 px-3.5 py-2 rounded-full text-sm font-semibold bg-maroon-700 text-white"
        >
          Simple view On
        </button>
      </div>
    </header>
  );
}

export function SeniorTileGrid() {
  const { senior } = useApp();
  const enabled = senior.essentials.filter((e) => e.enabled);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5 max-w-3xl mx-auto">
      {enabled.map((e) => {
        const meta = seniorNavMap[e.key];
        return (
          <NavLink
            key={e.key}
            to={meta.to}
            className="flex items-center gap-4 px-6 py-6 rounded-[16px] border-2 border-[var(--w360-border)] bg-[var(--w360-bg-raised)] hover:border-maroon-600 hover:bg-maroon-50 dark:hover:bg-white/[0.06] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--w360-focus)]"
          >
            <meta.icon size={34} strokeWidth={1.6} className="text-maroon-700 dark:text-maroon-200 shrink-0" />
            <span className="font-display text-xl font-semibold">{meta.plainLabel}</span>
          </NavLink>
        );
      })}
      <NavLink
        to="/app/settings?tab=essentials"
        className="flex items-center gap-4 px-6 py-6 rounded-[16px] border-2 border-dashed border-[var(--w360-border)] text-[var(--w360-text-muted)] hover:text-[var(--w360-text)] hover:border-maroon-400 transition-colors"
      >
        <span className="font-display text-lg font-semibold">Choose your essentials</span>
      </NavLink>
    </div>
  );
}
