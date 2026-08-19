import { NavLink } from "react-router-dom";
import { standardNav } from "@/config/navigation";
import clsx from "clsx";

export function Sidebar() {
  return (
    <aside className="hidden lg:flex flex-col w-60 shrink-0 border-r border-[var(--w360-border)] h-screen sticky top-0 py-6">
      <div className="px-6 mb-8">
        <span className="font-display text-xl font-semibold tracking-tight">Women360</span>
      </div>
      <nav className="flex-1 flex flex-col gap-0.5 px-3 overflow-y-auto w360-scrollbar" aria-label="Primary">
        {standardNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium transition-colors",
                isActive
                  ? "bg-maroon-50 text-maroon-800 dark:bg-white/[0.07] dark:text-maroon-200"
                  : "text-[var(--w360-text-muted)] hover:bg-black/[0.03] hover:text-[var(--w360-text)] dark:hover:bg-white/[0.04]"
              )
            }
          >
            <item.icon size={18} strokeWidth={1.75} />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="px-3 pt-2 border-t border-[var(--w360-border)] mt-2">
        <NavLink
          to="/app/settings"
          className={({ isActive }) =>
            clsx(
              "flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium transition-colors",
              isActive ? "bg-maroon-50 text-maroon-800 dark:bg-white/[0.07] dark:text-maroon-200" : "text-[var(--w360-text-muted)] hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
            )
          }
        >
          Settings
        </NavLink>
      </div>
    </aside>
  );
}
