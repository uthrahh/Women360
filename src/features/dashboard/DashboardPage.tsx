import type { CSSProperties, ReactNode } from "react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { SeniorTileGrid } from "@/components/layout/SeniorNav";
import { Card, CardBody } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { LoadingState } from "@/components/ui/states";
import { ItemList } from "@/components/ui/ItemList";
import { TodayTasks } from "./TodayTasks";
import { cycleService } from "@/services/cycleService";
import { sleepService } from "@/services/sleepService";
import { activityService } from "@/services/activityService";
import { nutritionService } from "@/services/nutritionService";
import { healthService } from "@/services/healthService";
import { goalService } from "@/services/goalService";
import { habitService } from "@/services/habitService";
import { wellbeingService } from "@/services/wellbeingService";
import { MOOD_LABELS } from "@/services/mappers";
import { SLEEP_QUALITY_LABELS } from "@/types";
import type { CycleSummary, SleepSummary, ActivitySummary, NutritionSummary, Appointment, Goal, Habit, WellbeingEntry } from "@/types";
import { Droplet, Moon, Activity as ActivityIcon, Smile, CalendarClock, Plus, ChevronRight, Flame, type LucideIcon } from "lucide-react";

const PHASE_LABEL: Record<string, string> = {
  menstrual: "Menstrual phase",
  follicular: "Follicular phase",
  ovulation: "Ovulation phase",
  luteal: "Luteal phase",
};

const QUICK_LOG = [
  { label: "Period", to: "/app/cycle" },
  { label: "Meal", to: "/app/nutrition" },
  { label: "Activity", to: "/app/activity" },
  { label: "Sleep", to: "/app/sleep" },
  { label: "Mood", to: "/app/wellbeing" },
  { label: "Measurement", to: "/app/health" },
];

const primaryLinkClass =
  "inline-flex items-center justify-center gap-2 rounded-full bg-maroon-700 text-white px-5 py-3 text-sm font-medium transition-[background-color,transform] hover:bg-maroon-800 active:scale-[0.98] dark:bg-maroon-300 dark:text-ink-900 dark:hover:bg-maroon-200";

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function DashboardPage() {
  const { senior } = useApp();

  if (senior.seniorMode) return <SeniorTileGrid />;
  return <StandardDashboard />;
}

function StandardDashboard() {
  const { auth } = useApp();
  const nav = useNavigate();
  const [cycle, setCycle] = useState<CycleSummary | null>(null);
  const [sleep, setSleep] = useState<SleepSummary | null>(null);
  const [activity, setActivity] = useState<ActivitySummary | null>(null);
  const [nutrition, setNutrition] = useState<NutritionSummary | null>(null);
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [goals, setGoals] = useState<Goal[] | null>(null);
  const [habits, setHabits] = useState<Habit[] | null>(null);
  const [todayMood, setTodayMood] = useState<WellbeingEntry | null>(null);
  const [moodLoaded, setMoodLoaded] = useState(false);

  useEffect(() => {
    cycleService.getSummary().then(setCycle);
    sleepService.getSummary().then(setSleep);
    activityService.getSummary().then(setActivity);
    nutritionService.getToday().then(setNutrition);
    healthService.getAppointments().then(setAppts);
    goalService.list().then(setGoals);
    habitService.list().then(setHabits);
    wellbeingService.getTodayMood().then((m) => {
      setTodayMood(m);
      setMoodLoaded(true);
    });
  }, []);

  const loaded = cycle && sleep && activity && nutrition && goals && habits && moodLoaded;
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = auth.user?.name?.split(" ")[0] ?? "there";

  if (!loaded) return <LoadingState label="Preparing your snapshot" />;

  const hydrationPct = Math.round((nutrition.hydrationMl / nutrition.hydrationGoalMl) * 100);
  const goalsDone = goals.filter((g) => g.completed).length;
  const daysActiveThisWeek = activity.weeklyMinutes.filter((d) => d.minutes > 0).length;

  return (
    <div className="flex flex-col gap-10">
      <header className="w360-rise" style={{ "--i": 0 } as CSSProperties}>
        <p className="text-sm text-[var(--w360-text-muted)]">
          {now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </p>
        <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.08] mt-2">
          {greeting},{" "}
          <span className="text-maroon-700 dark:text-maroon-300">{firstName}</span>.
        </h1>
      </header>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="flex flex-col gap-10 min-w-0">
          <section className="w360-rise" style={{ "--i": 1 } as CSSProperties} aria-label="Your cycle">
            <CycleHero cycle={cycle} />
          </section>

          <section className="w360-rise" style={{ "--i": 2 } as CSSProperties} aria-label="To do today">
            <SectionHeading title="To do today" />
            <TodayTasks
              habits={habits}
              onHabitChange={(h) => setHabits((list) => (list ? list.map((x) => (x.id === h.id ? h : x)) : list))}
              todayMood={todayMood}
              appointments={appts}
            />
          </section>

          <section className="w360-rise" style={{ "--i": 3 } as CSSProperties} aria-label="Quick log">
            <SectionHeading title="Log something" />
            <div className="-mx-4 sm:mx-0 px-4 sm:px-0 flex gap-2 overflow-x-auto sm:overflow-visible sm:flex-wrap pb-1 w360-hide-scrollbar">
              {QUICK_LOG.map((a) => (
                <Link
                  key={a.label}
                  to={a.to}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-[var(--w360-border)] bg-[var(--w360-bg-raised)] px-4 py-2.5 text-sm font-medium transition-colors hover:border-maroon-400 hover:text-maroon-700 dark:hover:text-maroon-200"
                >
                  <Plus size={14} strokeWidth={2} /> {a.label}
                </Link>
              ))}
            </div>
          </section>

          <section className="w360-rise" style={{ "--i": 4 } as CSSProperties} aria-label="Today">
            <SectionHeading title="Today" />
            <Card>
              <CardBody className="p-0 divide-y divide-[var(--w360-border)]">
                <TodayRow
                  icon={Moon}
                  label="Sleep"
                  value={`${sleep.durationHours}h`}
                  sub={sleep.quality ? `${SLEEP_QUALITY_LABELS[sleep.quality]} quality` : "Not rated yet"}
                  to="/app/sleep"
                />
                <TodayRow
                  icon={Droplet}
                  label="Hydration"
                  value={`${nutrition.hydrationMl}ml`}
                  sub={`${hydrationPct}% of ${nutrition.hydrationGoalMl}ml`}
                  to="/app/nutrition"
                  progress={hydrationPct}
                />
                <TodayRow
                  icon={ActivityIcon}
                  label="Activity"
                  value={activity.steps.toLocaleString()}
                  sub="steps today"
                  to="/app/activity"
                />
                <TodayRow
                  icon={Smile}
                  label="Mood"
                  value={todayMood ? MOOD_LABELS[todayMood.mood] : "Not logged"}
                  sub={todayMood ? "logged today" : "Tap to check in"}
                  to="/app/wellbeing"
                />
                <TodayRow
                  icon={Flame}
                  label="Habits"
                  value={habits.length ? `${habits.filter((h) => h.doneToday).length}/${habits.length}` : "None yet"}
                  sub={habits.length ? "done today" : "Add your first one"}
                  to="/app/habits"
                />
                <TodayRow
                  icon={CalendarClock}
                  label="Goals"
                  value={goals.length ? `${goalsDone}/${goals.length}` : "None yet"}
                  sub={goals.length ? "completed" : "Set your first one"}
                  to="/app/goals"
                />
              </CardBody>
            </Card>
          </section>
        </div>

        <div className="flex flex-col gap-10 min-w-0">
          <section className="w360-rise" style={{ "--i": 5 } as CSSProperties} aria-label="This week">
            <SectionHeading title="This week" />
            <Card>
              <CardBody className="pt-5 grid grid-cols-2 gap-4">
                <div className="flex flex-col items-center text-center gap-3">
                  <ProgressRing
                    size={84}
                    strokeWidth={7}
                    value={activity.activeMinutesGoal ? (activity.activeMinutes / activity.activeMinutesGoal) * 100 : 0}
                    label={`${activity.activeMinutes}m`}
                  />
                  <div>
                    <p className="text-sm font-medium">Active today</p>
                    <p className="text-xs text-[var(--w360-text-muted)] mt-0.5">{daysActiveThisWeek} of 7 days logged</p>
                  </div>
                </div>
                <div className="flex flex-col items-center text-center gap-3">
                  <ProgressRing size={84} strokeWidth={7} value={sleep.consistencyScore} label={`${sleep.consistencyScore}%`} />
                  <div>
                    <p className="text-sm font-medium">Bedtime regularity</p>
                    <p className="text-xs text-[var(--w360-text-muted)] mt-0.5">
                      {sleep.history.length > 1 ? "from your logged bedtimes" : "log a few more nights"}
                    </p>
                  </div>
                </div>
              </CardBody>
            </Card>
          </section>

          <section className="w360-rise" style={{ "--i": 6 } as CSSProperties} aria-label="Upcoming">
            <SectionHeading
              title="Upcoming"
              action={<Link to="/app/health" className="text-sm font-medium text-maroon-700 dark:text-maroon-200">View all</Link>}
            />
            {appts.length === 0 ? (
              <p className="text-sm text-[var(--w360-text-muted)]">
                Nothing scheduled.{" "}
                <Link to="/app/health" className="font-medium text-maroon-700 dark:text-maroon-200 underline underline-offset-2">
                  Add an appointment
                </Link>
              </p>
            ) : (
              <ItemList
                ariaLabel="Upcoming"
                items={appts.slice(0, 5).map((x) => ({
                  id: x.id,
                  title: x.title,
                  description: [x.provider, x.location].filter(Boolean).join(" · "),
                  meta: `${shortDate(x.date)} · ${x.time}`,
                }))}
                maxHeight={320}
                onItemSelect={() => nav("/app/health?tab=appointments")}
              />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function CycleHero({ cycle }: { cycle: CycleSummary }) {
  if (cycle.currentDay === null || cycle.phase === null) {
    return (
      <Card tone="tint">
        <CardBody className="p-6 sm:p-8">
          <p className="text-xs font-semibold tracking-[0.14em] uppercase opacity-70">Your cycle</p>
          <p className="font-display text-3xl sm:text-4xl font-semibold tracking-tight leading-tight mt-3">
            Start with your last period.
          </p>
          <p className="text-sm opacity-80 mt-3 max-w-sm">
            Add when your last period began and Women360 starts showing your cycle day, phase, and a predicted range.
          </p>
          <Link to="/app/cycle" className={`${primaryLinkClass} mt-6`}>Open cycle</Link>
        </CardBody>
      </Card>
    );
  }

  const range =
    cycle.nextPeriodRangeStart && cycle.nextPeriodRangeEnd
      ? `${shortDate(cycle.nextPeriodRangeStart)} – ${shortDate(cycle.nextPeriodRangeEnd)}`
      : cycle.nextPeriodDate
        ? `around ${shortDate(cycle.nextPeriodDate)}`
        : null;

  return (
    <Card tone="tint">
      <CardBody className="p-6 sm:p-8">
        <p className="text-xs font-semibold tracking-[0.14em] uppercase opacity-70">Your cycle</p>
        <div className="flex items-baseline gap-3 mt-3">
          <span className="font-display text-6xl sm:text-7xl font-semibold tracking-tight tabular-nums leading-none">
            {cycle.currentDay}
          </span>
          <span className="text-base opacity-80">
            {cycle.isLate ? `day · ${cycle.daysLate} late` : `of ${cycle.cycleLength}`}
          </span>
        </div>
        <p className="text-lg font-medium mt-4">
          {cycle.isLate ? "Your period may be late" : PHASE_LABEL[cycle.phase]}
        </p>
        {range && (
          <p className="text-sm opacity-80 mt-1">
            Next period expected {range} — a range, not an exact date.
          </p>
        )}
        <Link to="/app/cycle" className={`${primaryLinkClass} mt-6`}>Open cycle</Link>
      </CardBody>
    </Card>
  );
}

function SectionHeading({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="font-display text-xl font-semibold tracking-tight">{title}</h2>
      {action}
    </div>
  );
}

function TodayRow({
  icon: Icon,
  label,
  value,
  sub,
  to,
  progress,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub: string;
  to: string;
  progress?: number;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03] first:rounded-t-[var(--w360-radius-card)] last:rounded-b-[var(--w360-radius-card)]"
    >
      <span className="w-11 h-11 shrink-0 rounded-full bg-[var(--w360-tint)] text-maroon-700 dark:text-maroon-200 flex items-center justify-center">
        <Icon size={20} strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-[var(--w360-text-muted)]">{label}</p>
        <p className="text-lg font-semibold tabular-nums leading-snug truncate">{value}</p>
        {progress !== undefined ? (
          <ProgressBar value={progress} className="mt-1.5" />
        ) : (
          <p className="text-xs text-[var(--w360-text-muted)] truncate">{sub}</p>
        )}
      </div>
      {progress !== undefined && <span className="text-xs text-[var(--w360-text-muted)] shrink-0">{sub}</span>}
      <ChevronRight size={16} className="text-[var(--w360-text-muted)] shrink-0" aria-hidden />
    </Link>
  );
}
