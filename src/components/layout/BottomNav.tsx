import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import GooeyNav from "@/components/reactbits/GooeyNav";
import { mobileBottomNav } from "@/config/navigation";
import { useBrandColors } from "@/hooks/useBrandColors";

const items = mobileBottomNav.map((n) => ({
  label: n.label,
  href: n.to,
  client: true,
  icon: <n.icon size={20} strokeWidth={1.75} />,
}));

function indexFor(pathname: string): number {
  const i = mobileBottomNav.findIndex((n) => pathname === n.to || pathname.startsWith(`${n.to}/`));
  return i < 0 ? 0 : i;
}

// Only phones and small tablets show this bar, so it only draws (and only holds
// a WebGL context) below the desktop breakpoint.
function useNarrow() {
  const query = "(max-width: 1023px)";
  const [narrow, setNarrow] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setNarrow(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return narrow;
}

// A floating pill: a droplet of tint melts from one destination to the next.
// The surface is near-opaque; it separates from the content, it isn't decorative glass.
export function BottomNav() {
  const { pathname } = useLocation();
  const nav = useNavigate();
  const brand = useBrandColors();
  const narrow = useNarrow();
  if (!narrow) return null;

  return (
    <nav
      className="lg:hidden fixed left-3 right-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 p-1.5 rounded-full border border-[var(--w360-border)] bg-[var(--w360-nav-surface)] backdrop-blur-md shadow-float"
      aria-label="Primary"
    >
      <GooeyNav
        className="gooey-nav--dock"
        items={items}
        activeIndex={indexFor(pathname)}
        onChange={(_, item) => nav(item.href as string)}
        size="sm"
        frame={false}
        theme={brand.dark ? "dark" : "light"}
        color={brand.tint}
        activeTextColor={brand.tintText}
        particleCount={8}
        spread={22}
        animationTime={450}
        hoverEffect={false}
        style={{ ["--gn-ink" as string]: "var(--w360-text)", ["--gn-muted" as string]: "var(--w360-text-muted)" }}
      />
    </nav>
  );
}
