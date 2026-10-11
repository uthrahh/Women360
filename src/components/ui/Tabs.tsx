import { useState, ReactNode } from "react";
import clsx from "clsx";

interface Tab {
  id: string;
  label: string;
  content: ReactNode;
}

export function Tabs({ tabs, defaultTab }: { tabs: Tab[]; defaultTab?: string }) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id);
  return (
    <div>
      <div
        role="tablist"
        className="inline-flex max-w-full gap-1 p-1 mb-5 rounded-full bg-warmgrey-100 dark:bg-white/[0.07] overflow-x-auto w360-hide-scrollbar"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={active === t.id}
            onClick={() => setActive(t.id)}
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
      {tabs.find((t) => t.id === active)?.content}
    </div>
  );
}
