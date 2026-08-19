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
      <div role="tablist" className="flex gap-1 border-b border-[var(--w360-border)] mb-5 overflow-x-auto w360-scrollbar">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={active === t.id}
            onClick={() => setActive(t.id)}
            className={clsx(
              "px-4 py-2.5 text-sm senior:text-lg font-medium whitespace-nowrap border-b-2 -mb-px transition-colors",
              active === t.id
                ? "border-maroon-700 text-maroon-800 dark:border-maroon-300 dark:text-maroon-200"
                : "border-transparent text-[var(--w360-text-muted)] hover:text-[var(--w360-text)]"
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
