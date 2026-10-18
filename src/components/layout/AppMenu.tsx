import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import BranchedMenu from "@/components/reactbits/BranchedMenu";
import { menuTree, type NavItem } from "@/config/navigation";

const ALL_ROUTES = menuTree.flatMap((node) => ("leaf" in node ? [node.leaf] : node.items));

/** The nav item whose route contains the current path (longest match wins). */
function activeRoute(pathname: string): string {
  const match = ALL_ROUTES.filter((n) => pathname === n.to || pathname.startsWith(`${n.to}/`)).sort(
    (a, b) => b.to.length - a.to.length
  )[0];
  return match?.to ?? "";
}

const icon = (item: NavItem) => <item.icon size={16} strokeWidth={1.75} />;

/**
 * The signed-in navigation: a branched tree (React Bits BranchedMenu) wired to
 * the router. The route is the source of truth for the highlight, so deep
 * links and browser back/forward move it correctly.
 */
export function AppMenu({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const nav = useNavigate();

  const items = useMemo(
    () =>
      menuTree.map((node) =>
        "leaf" in node
          ? { label: node.leaf.label, value: node.leaf.to }
          : {
              label: node.label,
              children: node.items.map((i) => ({ value: i.to, label: i.label, icon: icon(i) })),
            }
      ),
    []
  );

  return (
    <BranchedMenu
      items={items}
      // Every branch starts open: the whole app stays one glance away, and a
      // person who wants it tidier can fold what they don't use.
      defaultOpen={items.flatMap((it, i) => (it.children ? [i] : []))}
      active={activeRoute(pathname)}
      onSelect={(value) => {
        nav(value);
        onNavigate?.();
      }}
      color="var(--w360-text)"
      accentColor="var(--w360-accent)"
      lineColor="var(--w360-border)"
      width={208}
      rowHeight={38}
      fontSize={14}
    />
  );
}
