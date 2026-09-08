import { useEffect, useState, type FormEvent } from "react";
import { cycleService } from "@/services/cycleService";
import { localDateISO } from "@/services/mappers";
import type { CycleSummary } from "@/types";
import { LoadingState, EmptyState } from "@/components/ui/states";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useApp } from "@/context/AppContext";
import { Trash2 } from "lucide-react";

const PHASE_LABEL: Record<string, string> = {
  menstrual: "Menstrual", follicular: "Follicular", ovulation: "Ovulation", luteal: "Luteal",
};

const SYMPTOM_OPTIONS = ["Cramps", "Fatigue", "Headache", "Bloating", "Tender breasts", "Backache"];

// Once a woman has logged at least one entry, the backend fills in
// currentDay/phase/nextPeriodDate — this narrows those three fields so
// CycleRing/SeniorCycle never have to null-check them.
type PopulatedCycleSummary = CycleSummary & {
  currentDay: number;
  phase: Exclude<CycleSummary["phase"], null>;
  nextPeriodDate: string;
};

export default function CyclePage() {
  const { senior } = useApp();
  const [cycle, setCycle] = useState<CycleSummary | null>(null);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [confirmDeleteDate, setConfirmDeleteDate] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    cycleService.getSummary().then(setCycle);
  }, []);

  if (!cycle) return <LoadingState label="Loading your cycle" />;

  const hasData = cycle.currentDay !== null && cycle.phase !== null && cycle.nextPeriodDate !== null;
  const existingDay = editingDate ? cycle.history.find((d) => d.date === editingDate) : undefined;
  const isToday = editingDate === localDateISO();

  function handleLog(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingDate) return;
    const form = new FormData(e.currentTarget);
    const flow = String(form.get("flow") ?? "") as "spotting" | "light" | "medium" | "heavy" | "";
    const pain = Number(form.get("pain") ?? 0);
    const symptoms = SYMPTOM_OPTIONS.filter((s) => form.get(`symptom_${s}`));
    const notes = String(form.get("notes") ?? "");
    const date = editingDate;

    cycleService.logDay({ date, flow: flow || undefined, pain, symptoms, notes }).then(
      () => {
        // Re-fetch rather than hand-patch local state: logging the very
        // first entry changes currentDay/phase/nextPeriodDate too, not just
        // one day's history item.
        cycleService.getSummary().then(setCycle);
        setEditingDate(null);
        toast.show(existingDay ? "Cycle entry updated" : "Cycle entry saved");
      },
      (err) => toast.show(err instanceof Error ? err.message : "Couldn't save that entry. Please try again.", { tone: "error" })
    );
  }

  function handleDelete() {
    if (!confirmDeleteDate) return;
    const date = confirmDeleteDate;
    cycleService.deleteEntry(date).then(
      () => {
        cycleService.getSummary().then(setCycle);
        setConfirmDeleteDate(null);
        setEditingDate(null);
        toast.show("Cycle entry deleted");
      },
      (err) => {
        toast.show(err instanceof Error ? err.message : "Couldn't delete that entry. Please try again.", { tone: "error" });
        setConfirmDeleteDate(null);
      }
    );
  }

  const modalTitle = editingDate
    ? isToday
      ? "Log today's flow & symptoms"
      : `${existingDay ? "Edit" : "Log"} entry for ${new Date(editingDate).toLocaleDateString(undefined, { month: "long", day: "numeric" })}`
    : "";

  const logModal = (
    <Modal open={editingDate !== null} onClose={() => setEditingDate(null)} title={modalTitle} size="sm">
      <form className="flex flex-col gap-4" onSubmit={handleLog}>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="flow" className="text-sm font-medium senior:text-lg">Flow</label>
          <select
            id="flow"
            name="flow"
            defaultValue={existingDay?.flow ?? ""}
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
          <input id="pain" name="pain" type="range" min={0} max={4} defaultValue={existingDay?.pain ?? 0} className="accent-[#6B1D30]" />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium senior:text-lg">Symptoms</span>
          <div className="grid grid-cols-2 gap-2">
            {SYMPTOM_OPTIONS.map((s) => (
              <label key={s} className="flex items-center gap-2 text-sm senior:text-base">
                <input type="checkbox" name={`symptom_${s}`} defaultChecked={existingDay?.symptoms?.includes(s)} className="w-4 h-4 accent-[#6B1D30]" />
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
            defaultValue={existingDay?.notes ?? ""}
            className="px-3.5 py-2.5 rounded border border-[var(--w360-border)] bg-[var(--w360-bg-raised)] text-sm senior:text-lg"
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          {existingDay ? (
            <Button
              type="button"
              variant="danger"
              onClick={() => editingDate && setConfirmDeleteDate(editingDate)}
            >
              <Trash2 size={15} /> Delete entry
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" size="lg">Save entry</Button>
        </div>
      </form>
    </Modal>
  );

  const deleteConfirm = (
    <ConfirmDialog
      open={confirmDeleteDate !== null}
      title="Delete this cycle entry?"
      description={confirmDeleteDate ? `The entry for ${new Date(confirmDeleteDate).toLocaleDateString()} will be removed.` : undefined}
      confirmLabel="Delete"
      onConfirm={handleDelete}
      onCancel={() => setConfirmDeleteDate(null)}
    />
  );

  if (!hasData) {
    return (
      <>
        <EmptyState
          title="Log your first entry to get started"
          description="Once you log a period, flow, or symptom, Women360 will start showing your cycle day, phase, and predictions here."
          action={<Button onClick={() => setEditingDate(localDateISO())}>Log today's flow & symptoms</Button>}
        />
        {logModal}
        {deleteConfirm}
      </>
    );
  }

  const populated = cycle as PopulatedCycleSummary;

  if (senior.seniorMode) {
    return (
      <>
        <SeniorCycle cycle={populated} onLog={() => setEditingDate(localDateISO())} />
        {logModal}
        {deleteConfirm}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Cycle</h1>
        <p className="text-[var(--w360-text-muted)] mt-1">A gentle picture of where you are in your cycle.</p>
      </div>

      <CycleRing cycle={populated} onLog={() => setEditingDate(localDateISO())} />

      <Tabs
        tabs={[
          { id: "overview", label: "Overview", content: <OverviewTab cycle={cycle} /> },
          { id: "calendar", label: "Calendar", content: <CalendarTab cycle={cycle} onSelectDay={setEditingDate} /> },
          { id: "trends", label: "Trends", content: <TrendsTab cycle={cycle} /> },
        ]}
      />
      {logModal}
      {deleteConfirm}
    </div>
  );
}

function CycleRing({ cycle, onLog }: { cycle: PopulatedCycleSummary; onLog: () => void }) {
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
  const avgCycleLength = cycle.lastCycleLengths.length
    ? `${Math.round(cycle.lastCycleLengths.reduce((a, b) => a + b, 0) / cycle.lastCycleLengths.length)} days`
    : "Not enough data yet";
  return (
    <div className="grid sm:grid-cols-3 gap-3">
      <Stat label="Average cycle length" value={avgCycleLength} />
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

function CalendarTab({ cycle, onSelectDay }: { cycle: CycleSummary; onSelectDay: (date: string) => void }) {
  const days = cycle.history.slice(-35);
  const today = localDateISO();

  return (
    <Card>
      <CardBody className="pt-5">
        <p className="text-sm text-[var(--w360-text-muted)] mb-4">Tap a day to log period, flow, pain, symptoms, mood, energy or a note.</p>
        <div className="grid grid-cols-7 gap-2">
          {days.map((d) => (
            <button
              key={d.date}
              type="button"
              onClick={() => onSelectDay(d.date)}
              aria-label={`${d.date === today ? "Today, " : ""}${new Date(d.date).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}${d.isPeriod ? ", period day" : ""}${d.symptoms?.length ? `, symptoms: ${d.symptoms.join(", ")}` : ""} — tap to log or edit`}
              className={`aspect-square rounded flex flex-col items-center justify-center text-xs gap-0.5 border transition-colors ${
                d.isPeriod
                  ? "bg-maroon-600 text-white border-maroon-600"
                  : "border-[var(--w360-border)] hover:border-maroon-400"
              } ${d.date === today ? "ring-2 ring-offset-1 ring-maroon-400 dark:ring-offset-ink-900" : ""}`}
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

function SeniorCycle({ cycle, onLog }: { cycle: PopulatedCycleSummary; onLog: () => void }) {
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
