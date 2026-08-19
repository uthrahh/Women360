import { NavLink } from "react-router-dom";
import { mobileBottomNav } from "@/config/navigation";
import clsx from "clsx";

export function BottomNav() {
  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--w360-bg-raised)] border-t border-[var(--w360-border)] flex justify-around py-1.5 pb-[env(safe-area-inset-bottom)]"
      aria-label="Primary"
    >
      {mobileBottomNav.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            clsx(
              "flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded text-[11px] font-medium min-w-[56px]",
              isActive ? "text-maroon-700 dark:text-maroon-200" : "text-[var(--w360-text-muted)]"
            )
          }
        >
          <item.icon size={20} strokeWidth={1.75} />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
