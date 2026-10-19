import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { Card, CardBody } from "@/components/ui/Card";
import { habitService } from "@/services/habitService";
import { goalService } from "@/services/goalService";
import type { Goal, Habit } from "@/types";

const STAGE: Record<string, string> = {
  reproductive: "Reproductive years",
  perimenopause: "Perimenopause",
  menopause: "Menopause",
  postmenopause: "Postmenopause",
};

interface Stat {
  label: string;
  value: string;
  to: string;
}

// Who's signed in, and three numbers that come straight from what she has
// logged. Nothing here is a sample: while the numbers load, or if they fail to,
// they show a dash rather than a made-up figure. Each stat opens its page.
export function ProfileCard() {
  const { auth } = useApp();
  const user = auth.user;
  const [habits, setHabits] = useState<Habit[] | null>(null);
  const [goals, setGoals] = useState<Goal[] | null>(null);

  useEffect(() => {
    habitService.list().then(setHabits).catch(() => setHabits(null));
    goalService.list().then(setGoals).catch(() => setGoals(null));
  }, []);

  if (!user) return null;

  type Streak = Pick<Habit, "streak" | "streakUnit">;
  const best = habits ? habits.reduce<Streak>((a, h) => (h.streak > a.streak ? h : a), { streak: 0, streakUnit: "day" }) : null;
  const stats: Stat[] = [
    { label: "Habits", value: habits ? String(habits.length) : "—", to: "/app/habits" },
    {
      label: "Best streak",
      value: best ? (best.streak > 0 ? `${best.streak} ${best.streakUnit}${best.streak === 1 ? "" : "s"}` : "—") : "—",
      to: "/app/habits",
    },
    { label: "Goals done", value: goals ? String(goals.filter((g) => g.completed).length) : "—", to: "/app/goals" },
  ];

  return (
    <Card tone="tint">
      <CardBody className="p-5 sm:p-6">
        <div className="flex items-center gap-4">
          <span
            aria-hidden
            className="w-16 h-16 shrink-0 rounded-full bg-maroon-700 text-white dark:bg-maroon-300 dark:text-ink-900 flex items-center justify-center font-display text-2xl font-semibold"
          >
            {user.avatarInitials}
          </span>
          <div className="min-w-0">
            <p className="font-display text-2xl font-semibold leading-tight truncate">{user.name}</p>
            <p className="text-sm opacity-80 truncate">{user.email}</p>
            {user.lifeStage && <p className="text-xs opacity-70 mt-0.5">{STAGE[user.lifeStage]}</p>}
          </div>
        </div>
        <ul className="grid grid-cols-3 gap-2 sm:gap-3 mt-5">
          {stats.map((s) => (
            <li key={s.label}>
              <Link
                to={s.to}
                className="block rounded-2xl bg-white/70 dark:bg-white/[0.05] px-3 py-3 text-center transition-colors hover:bg-white dark:hover:bg-white/[0.09]"
              >
                <span className="block font-display text-xl sm:text-2xl font-semibold tabular-nums">{s.value}</span>
                <span className="block text-xs opacity-75 mt-0.5">{s.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
