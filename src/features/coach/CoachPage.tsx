import { useEffect, useState } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { coachService } from "@/services/coachService";
import type { CoachedWoman } from "@/types";
import clsx from "clsx";
import { WomanDetail } from "./WomanDetail";

const STAGE: Record<string, string> = {
  REPRODUCTIVE: "Reproductive years",
  PERIMENOPAUSE: "Perimenopause",
  MENOPAUSE: "Menopause",
  POSTMENOPAUSE: "Postmenopause",
};

/** The coach's working page: the women who chose to share, and what they shared. */
export default function CoachPage() {
  const [women, setWomen] = useState<CoachedWoman[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const load = () => {
    setFailed(false);
    coachService
      .assignedWomen()
      .then((list) => {
        setWomen(list);
        setSelected((s) => s ?? list[0]?.id ?? null);
      })
      .catch(() => setFailed(true));
  };
  useEffect(load, []);

  if (failed) return <ErrorState title="Couldn't load the people who shared with you" onRetry={load} />;
  if (!women) return <LoadingState />;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-3xl font-semibold">Your clients</h1>
        <p className="text-[var(--w360-text-muted)] mt-1">
          You see only what each person has chosen to share: goals, wellbeing, sleep, activity and coaching appointments.
        </p>
      </div>

      {women.length === 0 ? (
        <EmptyState
          title="No one has shared with you yet"
          description="A woman gives you access by entering your email under Settings, Privacy & sharing in her account. She can take it back at any time."
        />
      ) : (
        <div className="grid lg:grid-cols-[18rem_minmax(0,1fr)] gap-5 items-start">
          <nav aria-label="Clients">
            <ul className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-1">
              {women.map((w) => (
                <li key={w.id} className="shrink-0 lg:shrink">
                  <button
                    type="button"
                    onClick={() => setSelected(w.id)}
                    aria-current={selected === w.id ? "true" : undefined}
                    className={clsx(
                      "w-full text-left rounded-2xl border px-4 py-3 transition-colors",
                      selected === w.id ? "border-maroon-700 bg-[var(--w360-tint)] dark:border-maroon-300" : "border-[var(--w360-border)] hover:border-maroon-400"
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <span aria-hidden className="w-9 h-9 rounded-full bg-maroon-700 text-white dark:bg-maroon-300 dark:text-ink-900 grid place-items-center text-sm font-semibold">
                        {w.avatarInitials ?? w.name.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-medium truncate">{w.name}</span>
                        <span className="block text-xs text-[var(--w360-text-muted)]">{w.lifeStage ? STAGE[w.lifeStage] ?? "" : "Life stage not set"}</span>
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          {selected ? (
            <WomanDetail key={selected} womanId={selected} name={women.find((w) => w.id === selected)?.name ?? ""} />
          ) : (
            <Card><CardBody className="pt-5 text-sm text-[var(--w360-text-muted)]">Select a person.</CardBody></Card>
          )}
        </div>
      )}
    </div>
  );
}
