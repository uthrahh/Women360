import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Award, Check, Circle, Snowflake } from "lucide-react";
import clsx from "clsx";
import { gameService, type GameState } from "@/services/gameService";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ErrorState, LoadingState, EmptyState } from "@/components/ui/states";

/**
 * Game mode: her tracking scored as a game. Points for logging and for habits and programme tasks done, a level, a forgiving run
 * of active days, three daily quests and badges. Nothing is ever taken away, and nothing rewards a number on a scale.
 */
export default function GamePage() {
  const [g, setG] = useState<GameState | { enabled: false } | null>(null);
  const [failed, setFailed] = useState(false);
  const load = useCallback(() => {
    setFailed(false);
    gameService
      .state()
      .then(setG)
      .catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);

  if (failed)
    return <ErrorState title="Couldn't load your game" onRetry={load} />;
  if (!g) return <LoadingState />;
  if (!g.enabled) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-semibold">Game</h1>
        <EmptyState
          title="Game mode is off"
          description="Turn it on in Settings, Features, to earn points and levels for looking after yourself."
          action={
            <Link
              to="/app/settings?tab=features"
              className="font-medium text-maroon-700 dark:text-maroon-300"
            >
              Open Settings
            </Link>
          }
        />
      </div>
    );
  }
  const pct = ((g.xp - g.levelFrom) / (g.levelTo - g.levelFrom)) * 100;
  const done = g.today.quests.filter((q) => q.done).length;

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="font-display text-3xl font-semibold tabular-nums">
          Level {g.level}
        </h1>
        <p className="text-[var(--w360-text-muted)] mt-1 tabular-nums">
          {g.xp.toLocaleString()} points · {(g.levelTo - g.xp).toLocaleString()}{" "}
          to level {g.level + 1}
        </p>
        <ProgressBar
          value={pct}
          label={`Progress to level ${g.level + 1}`}
          className="mt-3"
        />
      </header>

      <section aria-labelledby="g-today" className="flex flex-col gap-3">
        <h2 id="g-today" className="font-display text-xl font-semibold">
          Today's quests{" "}
          <span className="text-sm font-normal text-[var(--w360-text-muted)] tabular-nums">
            {done} of {g.today.quests.length} · {g.today.points} points today
          </span>
        </h2>
        <ul className="flex flex-col gap-2">
          {g.today.quests.map((q) => (
            <li key={q.id} className="flex items-center gap-2">
              {q.done ? (
                <Check
                  size={18}
                  className="text-maroon-700 dark:text-maroon-300"
                  aria-hidden
                />
              ) : (
                <Circle
                  size={16}
                  className="text-[var(--w360-text-muted)]"
                  aria-hidden
                />
              )}
              <span>{q.label}</span>
              <span className="sr-only">{q.done ? "(done)" : "(not yet)"}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-[var(--w360-text-muted)]">
          Each quest done is 15 points, and all three is 20 more. New quests
          tomorrow.
        </p>
      </section>

      <section aria-labelledby="g-run" className="flex flex-col gap-1">
        <h2
          id="g-run"
          className="font-display text-xl font-semibold tabular-nums"
        >
          Your run: {g.run.current} {g.run.current === 1 ? "day" : "days"}
        </h2>
        <p className="text-sm text-[var(--w360-text-muted)] measure">
          Days in a row you logged anything. One rest day a week is built in
          {g.run.restLeftThisWeek ? " (this week's is still free)" : ""}, and
          every 7 active days earns a freeze for a busy day. Best so far:{" "}
          {g.run.best} days.
        </p>
        {g.run.freezes > 0 && (
          <p className="text-sm flex items-center gap-1.5">
            <Snowflake size={15} aria-hidden /> {g.run.freezes}{" "}
            {g.run.freezes === 1 ? "freeze" : "freezes"} saved
          </p>
        )}
      </section>

      <section aria-labelledby="g-badges" className="flex flex-col gap-3">
        <h2 id="g-badges" className="font-display text-xl font-semibold">
          Badges
        </h2>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          {g.badges.map((b) => (
            <li
              key={b.id}
              className={clsx(
                "flex items-start gap-2.5",
                !b.earned && "text-[var(--w360-text-muted)]",
              )}
            >
              <Award
                size={20}
                aria-hidden
                className={clsx(
                  "shrink-0 mt-0.5",
                  b.earned
                    ? "text-maroon-700 dark:text-maroon-300"
                    : "opacity-40",
                )}
              />
              <span>
                <span className="font-medium">{b.label}</span>{" "}
                <span className="sr-only">
                  {b.earned ? "(earned)" : "(not yet)"}
                </span>
                <span className="block text-xs">{b.description}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="g-rules" className="flex flex-col gap-2">
        <h2 id="g-rules" className="font-display text-xl font-semibold">
          How points work
        </h2>
        <table className="text-sm w-full max-w-md">
          <caption className="sr-only">
            Points for each thing logged, and how many count in a day
          </caption>
          <thead>
            <tr className="text-left text-[var(--w360-text-muted)]">
              <th scope="col" className="font-medium py-1">
                For
              </th>
              <th scope="col" className="font-medium py-1 text-right">
                Points
              </th>
              <th scope="col" className="font-medium py-1 text-right">
                Up to a day
              </th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {g.rules.map((r) => (
              <tr
                key={r.label}
                className="border-t border-[var(--w360-border)]"
              >
                <th scope="row" className="font-normal text-left py-1">
                  {r.label}
                </th>
                <td className="text-right py-1">{r.points}</td>
                <td className="text-right py-1">{r.perDay}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-[var(--w360-text-muted)] measure">
          Points are for looking after yourself, never for a number on a scale,
          calories or how much you did, and they are never taken away for a
          missed day. Turn game mode off in Settings at any time.
        </p>
      </section>
    </div>
  );
}
