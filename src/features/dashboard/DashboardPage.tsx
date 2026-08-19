import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { SeniorTileGrid } from "@/components/layout/SeniorNav";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { LoadingState } from "@/components/ui/states";
import { cycleService } from "@/services/cycleService";
import { sleepService } from "@/services/sleepService";
import { activityService } from "@/services/activityService";
import { nutritionService } from "@/services/nutritionService";
import { healthService } from "@/services/healthService";
import type { CycleSummary, SleepSummary, ActivitySummary, NutritionSummary, Appointment } from "@/types";
import { Droplet, Moon, Activity as ActivityIcon, Smile, CalendarHeart, CalendarClock, Plus } from "lucide-react";

export default function DashboardPage() {
  const { senior } = useApp();

  if (senior.seniorMode) return <SeniorTileGrid />;
  return <StandardDashboard />;
}

function StandardDashboard() {
  const [cycle, setCycle] = useState<CycleSummary | null>(null);
  const [sleep, setSleep] = useState<SleepSummary | null>(null);
  const [activity, setActivity] = useState<ActivitySummary | null>(null);
  const [nutrition, setNutrition] = useState<NutritionSummary | null>(null);
  const [appts, setAppts] = useState<Appointment[]>([]);

  useEffect(() => {
    cycleService.getSummary().then(setCycle);
    sleepService.getSummary().then(setSleep);
    activityService.getSummary().then(setActivity);
    nutritionService.getToday().then(setNutrition);
    healthService.getAppointments().then(setAppts);
  }, []);

  const loaded = cycle && sleep && activity && nutrition;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  if (!loaded) return <LoadingState label="Preparing your snapshot" />;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">{greeting}, Sarah.</h1>
        <p className="text-[var(--w360-text-muted)] mt-1">Here's your health snapshot for today.</p>
      </div>

      {/* Today's priorities */}
      <section>
        <SectionHeading title="Today's priorities" />
        <div className="grid sm:grid-cols-2 gap-3">
          <PriorityCard
            title="Your period may start soon"
            detail={`Expected around ${new Date(cycle!.nextPeriodDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })} — day ${cycle!.currentDay} of your cycle now.`}
            to="/app/cycle"
          />
          <PriorityCard
            title="Catch up on hydration"
            detail={`${nutrition!.hydrationMl}ml of ${nutrition!.hydrationGoalMl}ml logged today.`}
            to="/app/nutrition"
          />
        </div>
      </section>

      {/* Health snapshot */}
      <section>
        <SectionHeading title="Health snapshot" />
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <SnapshotTile icon={Moon} label="Sleep" value={`${sleep!.durationHours}h`} sub={`${sleep!.quality}% quality`} to="/app/sleep" />
          <SnapshotTile icon={ActivityIcon} label="Activity" value={`${activity!.steps.toLocaleString()}`} sub="steps today" to="/app/activity" />
          <SnapshotTile icon={Droplet} label="Hydration" value={`${Math.round((nutrition!.hydrationMl / nutrition!.hydrationGoalMl) * 100)}%`} sub="of daily goal" to="/app/nutrition" />
          <SnapshotTile icon={Smile} label="Mood" value="Good" sub="logged this morning" to="/app/wellbeing" />
          <SnapshotTile icon={CalendarHeart} label="Cycle" value={`Day ${cycle!.currentDay}`} sub={cycle!.phase} to="/app/cycle" />
          <SnapshotTile icon={CalendarClock} label="Goals" value="3/4" sub="on track" to="/app/goals" />
        </div>
      </section>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Quick actions */}
        <section className="lg:col-span-1">
          <SectionHeading title="Quick actions" />
          <Card>
            <CardBody className="grid grid-cols-2 gap-2 pt-5">
              {[
                { label: "Log period", to: "/app/cycle" },
                { label: "Log meal", to: "/app/nutrition" },
                { label: "Log activity", to: "/app/activity" },
                { label: "Log sleep", to: "/app/sleep" },
                { label: "Log mood", to: "/app/wellbeing" },
                { label: "Add measurement", to: "/app/health" },
              ].map((a) => (
                <Link key={a.label} to={a.to}>
                  <Button variant="secondary" size="sm" fullWidth className="justify-start">
                    <Plus size={15} /> {a.label}
                  </Button>
                </Link>
              ))}
            </CardBody>
          </Card>
        </section>

        {/* Trends */}
        <section className="lg:col-span-2">
          <SectionHeading title="Trends worth noticing" />
          <div className="grid sm:grid-cols-2 gap-3">
            <Card>
              <CardBody className="flex items-center gap-4 pt-5">
                <ProgressRing value={activity!.activeMinutes / activity!.activeMinutesGoal * 100} label={`${activity!.activeMinutes}m`} />
                <div>
                  <p className="text-sm font-semibold">Active minutes trending up</p>
                  <p className="text-sm text-[var(--w360-text-muted)]">+18% vs last week's average.</p>
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="flex items-center gap-4 pt-5">
                <ProgressRing value={sleep!.consistencyScore} label={`${sleep!.consistencyScore}%`} />
                <div>
                  <p className="text-sm font-semibold">Sleep consistency dipped</p>
                  <p className="text-sm text-[var(--w360-text-muted)]">Bedtime has shifted later this week.</p>
                </div>
              </CardBody>
            </Card>
          </div>
        </section>
      </div>

      {/* Upcoming */}
      <section>
        <SectionHeading title="Upcoming" action={<Link to="/app/health" className="text-sm font-medium text-maroon-700 dark:text-maroon-200">View all</Link>} />
        <Card>
          <CardBody className="p-0 divide-y divide-[var(--w360-border)]">
            {appts.slice(0, 3).map((a) => (
              <div key={a.id} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-sm font-medium">{a.title}</p>
                  <p className="text-xs text-[var(--w360-text-muted)] mt-0.5">{a.provider} · {a.location}</p>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <p className="text-sm font-medium tabular-nums">{new Date(a.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</p>
                  <p className="text-xs text-[var(--w360-text-muted)]">{a.time}</p>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      </section>
    </div>
  );
}

function SectionHeading({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {action}
    </div>
  );
}

function PriorityCard({ title, detail, to }: { title: string; detail: string; to: string }) {
  return (
    <Card className="border-maroon-200 dark:border-maroon-800/60">
      <CardBody className="pt-5">
        <Badge tone="accent">Priority</Badge>
        <p className="font-medium mt-2">{title}</p>
        <p className="text-sm text-[var(--w360-text-muted)] mt-1">{detail}</p>
        <Link to={to} className="text-sm font-semibold text-maroon-700 dark:text-maroon-200 mt-3 inline-block">
          View details →
        </Link>
      </CardBody>
    </Card>
  );
}

function SnapshotTile({ icon: Icon, label, value, sub, to }: { icon: any; label: string; value: string; sub: string; to: string }) {
  return (
    <Link to={to}>
      <Card className="hover:border-maroon-400 dark:hover:border-maroon-600 transition-colors h-full">
        <CardBody className="pt-5">
          <Icon size={18} className="text-maroon-700 dark:text-maroon-200 mb-2" strokeWidth={1.75} />
          <p className="text-xs text-[var(--w360-text-muted)]">{label}</p>
          <p className="text-lg font-semibold tabular-nums">{value}</p>
          <p className="text-xs text-[var(--w360-text-muted)]">{sub}</p>
        </CardBody>
      </Card>
    </Link>
  );
}
