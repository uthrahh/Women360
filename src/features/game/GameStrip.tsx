import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Circle } from "lucide-react";
import { gameService, type GameState } from "@/services/gameService";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useToast } from "@/components/ui/Toast";

/**
 * Game mode on the home screen: level, the run of active days and today's three quests. Hidden entirely when game mode is off,
 * and when it can't load (the rest of the home screen never waits for it). A new level is congratulated once.
 */
export function GameStrip() {
  const [g, setG] = useState<GameState | null>(null);
  const toast = useToast();
  useEffect(() => {
    let cancelled = false;
    gameService
      .state()
      .then((s) => {
        if (cancelled || !s.enabled) return;
        setG(s);
        if (s.newLevel) {
          toast.show(`Level ${s.newLevel}. Every log counted.`);
          void gameService.seen(s.newLevel).catch(() => {});
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!g) return null;
  const pct = ((g.xp - g.levelFrom) / (g.levelTo - g.levelFrom)) * 100;
  return (
    <section aria-labelledby="game-strip" className="flex flex-col gap-3 border-y border-[var(--w360-border)] py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="game-strip" className="font-display text-lg font-semibold">
          Level {g.level}{" "}
          <span className="text-sm font-normal text-[var(--w360-text-muted)] tabular-nums">
            · {g.xp.toLocaleString()} points · {g.run.current}-day run
          </span>
        </h2>
        <Link to="/app/game" className="text-sm font-medium text-maroon-700 dark:text-maroon-300">Your game</Link>
      </div>
      <ProgressBar value={pct} label={`Level ${g.level} progress`} />
      <ul className="flex flex-col sm:flex-row gap-2 sm:gap-5 text-sm" aria-label="Today's quests">
        {g.today.quests.map((q) => (
          <li key={q.id} className="flex items-center gap-1.5">
            {q.done ? <Check size={16} className="text-maroon-700 dark:text-maroon-300" aria-hidden /> : <Circle size={14} className="text-[var(--w360-text-muted)]" aria-hidden />}
            <span className={q.done ? "line-through text-[var(--w360-text-muted)]" : undefined}>{q.label}</span>
            <span className="sr-only">{q.done ? "(done)" : "(not yet)"}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
