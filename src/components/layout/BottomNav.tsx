import { NavLink } from "react-router-dom";
import { mobileBottomNav } from "@/config/navigation";
import clsx from "clsx";

// A floating pill rather than a full-bleed bar: it reads as a control sitting
// above the content, and the active destination gets a tonal pill instead of
// only a colour change. The surface is near-opaque — it separates from the
// content, it isn't decorative glass.
export function BottomNav() {
  return (
    <nav
      className="lg:hidden fixed left-3 right-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 flex justify-between gap-1 p-1.5 rounded-full border border-[var(--w360-border)] bg-[var(--w360-nav-surface)] backdrop-blur-md shadow-float"
      aria-label="Primary"
    >
      {mobileBottomNav.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            clsx(
              "flex-1 flex flex-col items-center gap-0.5 py-2 rounded-full text-[11px] font-medium transition-colors",
              isActive
                ? "bg-[var(--w360-tint)] text-maroon-800 dark:bg-white/10 dark:text-maroon-200"
                : "text-[var(--w360-text-muted)]"
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
