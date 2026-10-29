import type { CSSProperties, ReactNode } from "react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { SeniorTileGrid } from "@/components/layout/SeniorNav";
import { Card, CardBody } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { LoadingState } from "@/components/ui/states";
import { ItemList } from "@/components/ui/ItemList";
import { TodayTasks } from "./TodayTasks";
import { cycleService } from "@/services/cycleService";
import { sleepService } from "@/services/sleepService";
import { activityService } from "@/services/activityService";
import { nutritionService } from "@/services/nutritionService";
import { healthService } from "@/services/healthService";
import { habitService } from "@/services/habitService";
import { wellbeingService } from "@/services/wellbeingService";
import { MOOD_LABELS } from "@/services/mappers";
import { cycleCardPhase } from "@/lib/cycleCard";
import { SLEEP_QUALITY_LABELS } from "@/types";
import type { CycleSummary, SleepSummary, ActivitySummary, NutritionSummary, Appointment, Habit, WellbeingEntry } from "@/types";
import { Droplet, Moon, Activity as ActivityIcon, Smile, Plus, ChevronRight, type LucideIcon } from "lucide-react";

const QUICK_LOG = [
  { label: "Period", to: "/app/cycle" },
  { label: "Meal", to: "/app/nutrition" },
  { label: "Activity", to: "/app/activity" },
  { label: "Sleep", to: "/app/sleep" },
  { label: "Mood", to: "/app/wellbeing" },
  { label: "Measurement", to: "/app/health" },
];

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
  const [showOvulation, setShowOvulation] = useState(false);
  const [sleep, setSleep] = useState<SleepSummary | null>(null);
  const [activity, setActivity] = useState<ActivitySummary | null>(null);
  const [nutrition, setNutrition] = useState<NutritionSummary | null>(null);
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [habits, setHabits] = useState<Habit[] | null>(null);
  const [todayMood, setTodayMood] = useState<WellbeingEntry | null>(null);
  const [moodLoaded, setMoodLoaded] = useState(false);

  useEffect(() => {
    cycleService.getSummary().then(setCycle);
    cycleService.getProfile().then((p) => setShowOvulation(Boolean(p.showOvulationOnHome))).catch(() => undefined);
    sleepService.getSummary().then(setSleep);
    activityService.getSummary().then(setActivity);
    nutritionService.getToday().then(setNutrition);
    healthService.getAppointments().then(setAppts);
    habitService.list().then(setHabits);
    wellbeingService.getTodayMood().then((m) => {
      setTodayMood(m);
      setMoodLoaded(true);
    });
  }, []);

  const loaded = cycle && sleep && activity && nutrition && habits && moodLoaded;
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = auth.user?.name?.split(" ")[0] ?? "there";

  if (!loaded) return <LoadingState label="Preparing your snapshot" />;

  const hydrationPct = Math.round((nutrition.hydrationMl / nutrition.hydrationGoalMl) * 100);
  const cyclePhase = cycleCardPhase(cycle, showOvulation);

  return (
    <div className="flex flex-col gap-8">
      <header className="w360-rise" style={{ "--i": 0 } as CSSProperties}>
        <p className="text-sm text-[var(--w360-text-muted)]">
          {now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </p>
        <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.08] mt-2">
          {greeting},{" "}
          <span className="text-maroon-700 dark:text-maroon-300">{firstName}</span>.
        </h1>
      </header>

      {cyclePhase && (
        <section className="w360-rise" style={{ "--i": 1 } as CSSProperties} aria-label="Your cycle">
          <CycleCard cycle={cycle} phase={cyclePhase} />
        </section>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="flex flex-col gap-8 min-w-0">
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
        </div>

        <div className="flex flex-col gap-8 min-w-0">
          <section className="w360-rise" style={{ "--i": 4 } as CSSProperties} aria-label="Today so far">
            <SectionHeading title="Today so far" />
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
                <TodayRow icon={ActivityIcon} label="Activity" value={activity.steps.toLocaleString()} sub="steps today" to="/app/activity" />
                <TodayRow
                  icon={Smile}
                  label="Mood"
                  value={todayMood ? MOOD_LABELS[todayMood.mood] : "Not logged"}
                  sub={todayMood ? "logged today" : "Tap to check in"}
                  to="/app/wellbeing"
                />
              </CardBody>
            </Card>
          </section>

          {appts.length > 0 && (
            <section className="w360-rise" style={{ "--i": 5 } as CSSProperties} aria-label="Upcoming">
              <SectionHeading
                title="Upcoming"
                action={<Link to="/app/health" className="text-sm font-medium text-maroon-700 dark:text-maroon-200">View all</Link>}
              />
              <ItemList
                ariaLabel="Upcoming"
                items={appts.slice(0, 3).map((x) => ({
                  id: x.id,
                  title: x.title,
                  description: [x.provider, x.location].filter(Boolean).join(" · "),
                  meta: `${shortDate(x.date)} · ${x.time}`,
                }))}
                maxHeight={240}
                onItemSelect={() => nav("/app/health?tab=appointments")}
              />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function CycleCard({ cycle, phase }: { cycle: CycleSummary; phase: "menstrual" | "ovulation" }) {
  const menstruating = phase === "menstrual";
  return (
    <Card tone="tint">
      <CardBody className="p-5 sm:p-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-[0.14em] uppercase opacity-70">Your cycle</p>
          <p className="font-display text-3xl sm:text-4xl font-semibold tracking-tight leading-tight mt-1.5">
            {menstruating ? `Day ${cycle.currentDay} of your period` : "Ovulation phase"}
          </p>
          <p className="text-sm opacity-80 mt-1">
            {menstruating ? `Day ${cycle.currentDay} of a ${cycle.cycleLength}-day cycle.` : `Day ${cycle.currentDay} of ${cycle.cycleLength}. An estimate, not a way to prevent or plan pregnancy.`}
          </p>
        </div>
        <Link
          to="/app/cycle"
          className="inline-flex items-center justify-center rounded-full border border-maroon-700 text-maroon-700 dark:border-maroon-300 dark:text-maroon-200 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-maroon-50 dark:hover:bg-white/5"
        >
          Open cycle
        </Link>
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
