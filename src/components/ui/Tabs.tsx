import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import clsx from "clsx";

interface Tab {
  id: string;
  label: string;
  content: ReactNode;
}

/**
 * Tabs that follow the standard pattern: the arrow keys, Home and End move between them (only the selected tab is in the
 * Tab order), each tab is linked to its panel, and a row that is wider than the screen fades at the edge that has more
 * and keeps the selected tab in view. With `urlParam` the selected tab is kept in the address (?tab=reminders), so a reload,
 * the Back button and a shared link all return to the same tab.
 */
export function Tabs({ tabs, defaultTab, urlParam }: { tabs: Tab[]; defaultTab?: string; urlParam?: string }) {
  const base = useId();
  const [params, setParams] = useSearchParams();
  const [local, setLocal] = useState(defaultTab ?? tabs[0]?.id);
  const fromUrl = urlParam ? params.get(urlParam) : null;
  const active = fromUrl && tabs.some((t) => t.id === fromUrl) ? fromUrl : local;

  const select = (id: string) => {
    setLocal(id);
    if (urlParam) {
      const next = new URLSearchParams(params);
      next.set(urlParam, id);
      setParams(next, { replace: true });
    }
  };

  const listRef = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState({ left: false, right: false });
  const measure = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    setMore({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure, tabs.length]);

  // Keep the selected tab visible (it may have been chosen from the address, or with the keyboard).
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const index = tabs.findIndex((t) => t.id === active);
    let next = -1;
    if (e.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    select(tabs[next].id);
    listRef.current?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus();
  }

  const edge = `${more.left ? "transparent, #000 28px" : "#000, #000"}, ${more.right ? "#000 calc(100% - 28px), transparent" : "#000, #000"}`;
  const mask = more.left || more.right ? `linear-gradient(to right, ${edge})` : undefined;

  return (
    <div>
      <div
        ref={listRef}
        role="tablist"
        onKeyDown={onKeyDown}
        onScroll={measure}
        style={mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined}
        className="inline-flex max-w-full gap-1 p-1 mb-5 rounded-full bg-warmgrey-100 dark:bg-white/[0.07] overflow-x-auto w360-hide-scrollbar"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            id={`${base}-tab-${t.id}`}
            role="tab"
            type="button"
            aria-selected={active === t.id}
            aria-controls={`${base}-panel-${t.id}`}
            tabIndex={active === t.id ? 0 : -1}
            onClick={() => select(t.id)}
            className={clsx(
              "px-4 py-2 text-sm senior:text-lg font-medium whitespace-nowrap rounded-full transition-colors",
              active === t.id
                ? "bg-[var(--w360-bg-raised)] text-maroon-800 dark:text-maroon-200 shadow-subtle"
                : "text-[var(--w360-text-muted)] hover:text-[var(--w360-text)]"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) =>
        t.id === active ? (
          <div key={t.id} id={`${base}-panel-${t.id}`} role="tabpanel" aria-labelledby={`${base}-tab-${t.id}`}>
            {t.content}
          </div>
        ) : null
      )}
    </div>
  );
}
