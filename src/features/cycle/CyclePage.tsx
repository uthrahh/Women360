import { useEffect, useState, type FormEvent } from "react";
import { cycleService } from "@/services/cycleService";
import type { CycleSummary } from "@/types";
import { LoadingState, EmptyState } from "@/components/ui/states";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useApp } from "@/context/AppContext";

const PHASE_LABEL: Record<string, string> = {
  menstrual: "Menstrual", follicular: "Follicular", ovulation: "Ovulation", luteal: "Luteal",
};

const SYMPTOM_OPTIONS = ["Cramps", "Fatigue", "Headache", "Bloating", "Tender breasts", "Backache"];

export default function CyclePage() {
  const { senior } = useApp();
  const [cycle, setCycle] = useState<CycleSummary | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const toast = useToast();

  useEffect(() => {
    cycleService.getSummary().then(setCycle);
  }, []);

  if (!cycle) return <LoadingState label="Loading your cycle" />;

  function handleLog(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const flow = String(form.get("flow") ?? "") as "spotting" | "light" | "medium" | "heavy" | "";
    const pain = Number(form.get("pain") ?? 0);
    const symptoms = SYMPTOM_OPTIONS.filter((s) => form.get(`symptom_${s}`));
    const notes = String(form.get("notes") ?? "");
    const today = new Date().toISOString().slice(0, 10);

    cycleService.logDay({ date: today, flow: flow || undefined, pain, symptoms, notes }).then(() => {
      setCycle((c) => {
        if (!c) return c;
        const history = [...c.history];
        const last = { ...history[history.length - 1] };
        history[history.length - 1] = { ...last, isPeriod: !!flow, flow: flow || undefined, pain, symptoms, notes };
        return { ...c, history };
      });
      setLogOpen(false);
      toast.show("Today's cycle entry saved");
    });
  }

  const logModal = (
    <Modal open={logOpen} onClose={() => setLogOpen(false)} title="Log today's flow & symptoms" size="sm">
      <form className="flex flex-col gap-4" onSubmit={handleLog}>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="flow" className="text-sm font-medium senior:text-lg">Flow</label>
          <select
            id="flow"
            name="flow"
            defaultValue=""
            className="px-3.5 py-2.5 rounded border border-[var(--w360-border)] bg-[var(--w360-bg-raised)] text-[var(--w360-text)] text-sm senior:text-lg senior:py-3.5"
          >
            <option value="">None today</option>
            <option value="spotting">Spotting</option>
            <option value="light">Light</option>
            <option value="medium">Medium</option>
            <option value="heavy">Heavy</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pain" className="text-sm font-medium senior:text-lg">Pain level (0–4)</label>
          <input id="pain" name="pain" type="range" min={0} max={4} defaultValue={0} className="accent-[#6B1D30]" />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium senior:text-lg">Symptoms</span>
          <div className="grid grid-cols-2 gap-2">
            {SYMPTOM_OPTIONS.map((s) => (
              <label key={s} className="flex items-center gap-2 text-sm senior:text-base">
                <input type="checkbox" name={`symptom_${s}`} className="w-4 h-4 accent-[#6B1D30]" />
                {s}
              </label>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="notes" className="text-sm font-medium senior:text-lg">Notes (optional)</label>
          <textarea
            id="notes"
            name="notes"
            rows={2}
            className="px-3.5 py-2.5 rounded border border-[var(--w360-border)] bg-[var(--w360-bg-raised)] text-sm senior:text-lg"
          />
        </div>
        <Button type="submit" size="lg">Save entry</Button>
      </form>
    </Modal>
  );

  if (senior.seniorMode) {
    return (
      <>
        <SeniorCycle cycle={cycle} onLog={() => setLogOpen(true)} />
        {logModal}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Cycle</h1>
        <p className="text-[var(--w360-text-muted)] mt-1">A gentle picture of where you are in your cycle.</p>
      </div>

      <CycleRing cycle={cycle} onLog={() => setLogOpen(true)} />

      <Tabs
        tabs={[
          { id: "overview", label: "Overview", content: <OverviewTab cycle={cycle} /> },
          { id: "calendar", label: "Calendar", content: <CalendarTab cycle={cycle} /> },
          { id: "trends", label: "Trends", content: <TrendsTab cycle={cycle} /> },
        ]}
      />
      {logModal}
    </div>
  );
}

function CycleRing({ cycle, onLog }: { cycle: CycleSummary; onLog: () => void }) {
  const size = 180;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = (cycle.currentDay / cycle.cycleLength) * 100;
  const offset = circ - (pct / 100) * circ;

  return (
    <Card>
      <CardBody className="flex flex-col sm:flex-row items-center gap-6 pt-6">
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="-rotate-90">
            <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="stroke-warmgrey-100 dark:stroke-white/10" fill="none" />
            <circle
              cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke}
              strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
              className="stroke-maroon-600 dark:stroke-maroon-300 transition-[stroke-dashoffset] duration-700" fill="none"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-display font-semibold tabular-nums">{cycle.currentDay}</span>
            <span className="text-xs text-[var(--w360-text-muted)]">of {cycle.cycleLength} days</span>
          </div>
        </div>
        <div className="flex-1 flex flex-col gap-2">
          <Badge tone="accent">{PHASE_LABEL[cycle.phase]} phase</Badge>
          <p className="text-sm text-[var(--w360-text-muted)]">
            Your next period is expected around{" "}
            <span className="font-medium text-[var(--w360-text)]">
              {new Date(cycle.nextPeriodDate).toLocaleDateString(undefined, { month: "long", day: "numeric" })}
            </span>
            , based on your recent cycles.
          </p>
          <Button variant="primary" size="sm" className="w-fit mt-2" onClick={onLog}>Log today's flow & symptoms</Button>
        </div>
      </CardBody>
    </Card>
  );
}

function OverviewTab({ cycle }: { cycle: CycleSummary }) {
  const recent = cycle.history.slice(-7);
  return (
    <div className="grid sm:grid-cols-3 gap-3">
      <Stat label="Average cycle length" value={`${Math.round(cycle.lastCycleLengths.reduce((a, b) => a + b, 0) / cycle.lastCycleLengths.length)} days`} />
      <Stat label="Average period length" value={`${cycle.periodLength} days`} />
      <Stat label="Cycles tracked" value={`${cycle.lastCycleLengths.length}`} />
      <div className="sm:col-span-3">
        <Card>
          <CardBody className="pt-5">
            <p className="text-sm font-medium mb-3">Last 7 days</p>
            <div className="flex gap-2 flex-wrap">
              {recent.map((d) => (
                <div key={d.date} className="flex flex-col items-center gap-1 text-center w-12">
                  <span className="text-[10px] text-[var(--w360-text-muted)]">{new Date(d.date).toLocaleDateString(undefined, { weekday: "short" })}</span>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-medium ${d.isPeriod ? "bg-maroon-600 text-white" : "bg-warmgrey-100 dark:bg-white/10"}`}>
                    {new Date(d.date).getDate()}
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function CalendarTab({ cycle }: { cycle: CycleSummary }) {
  const days = cycle.history.slice(-35);
  return (
    <Card>
      <CardBody className="pt-5">
        <p className="text-sm text-[var(--w360-text-muted)] mb-4">Tap a day to log period, flow, pain, symptoms, mood, energy or a note.</p>
        <div className="grid grid-cols-7 gap-2">
          {days.map((d) => (
            <button
              key={d.date}
              className={`aspect-square rounded flex flex-col items-center justify-center text-xs gap-0.5 border transition-colors ${
                d.isPeriod
                  ? "bg-maroon-600 text-white border-maroon-600"
                  : "border-[var(--w360-border)] hover:border-maroon-400"
              }`}
              title={d.symptoms?.join(", ")}
            >
              <span className="font-medium">{new Date(d.date).getDate()}</span>
              {d.symptoms && d.symptoms.length > 0 && <span className="w-1 h-1 rounded-full bg-current opacity-70" />}
            </button>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

function TrendsTab({ cycle }: { cycle: CycleSummary }) {
  const data = cycle.lastCycleLengths.map((len, i) => ({ cycle: `C${i + 1}`, length: len }));
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardBody className="pt-5">
          <p className="text-sm font-medium mb-1">Cycle length</p>
          <p className="text-xs text-[var(--w360-text-muted)] mb-4">This pattern has stayed close to your usual range.</p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--w360-border)" vertical={false} />
                <XAxis dataKey="cycle" stroke="var(--w360-text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--w360-text-muted)" fontSize={12} tickLine={false} axisLine={false} domain={[20, 35]} />
                <Tooltip contentStyle={{ background: "var(--w360-bg-raised)", border: "1px solid var(--w360-border)", borderRadius: 8, fontSize: 13 }} />
                <Line type="monotone" dataKey="length" stroke="#6B1D30" strokeWidth={2.5} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>
      <EmptyState
        title="No unusual patterns detected"
        description="Women360 highlights changes from your own baseline here — not a diagnosis, just a nudge to pay attention if something shifts."
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardBody className="pt-5">
        <p className="text-xs text-[var(--w360-text-muted)]">{label}</p>
        <p className="text-2xl font-display font-semibold mt-1 tabular-nums">{value}</p>
      </CardBody>
    </Card>
  );
}

function SeniorCycle({ cycle, onLog }: { cycle: CycleSummary; onLog: () => void }) {
  return (
    <div className="max-w-xl mx-auto p-5 flex flex-col gap-5">
      <Card>
        <CardBody className="pt-6 flex flex-col items-center text-center gap-3">
          <span className="font-display text-5xl font-semibold tabular-nums">{cycle.currentDay}</span>
          <p className="text-lg">Day {cycle.currentDay} of your cycle</p>
          <p className="text-[var(--w360-text-muted)] text-lg">
            Next period expected around{" "}
            {new Date(cycle.nextPeriodDate).toLocaleDateString(undefined, { month: "long", day: "numeric" })}
          </p>
          <Button size="xl" fullWidth onClick={onLog}>Add today's flow</Button>
        </CardBody>
      </Card>
    </div>
  );
}
