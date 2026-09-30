import { useEffect, useState, type FormEvent } from "react";
import { cycleService } from "@/services/cycleService";
import { localDateISO } from "@/services/mappers";
import type { CycleDay, CycleDayPhase, CycleSummary } from "@/types";
import { LoadingState, EmptyState, ErrorState } from "@/components/ui/states";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useApp } from "@/context/AppContext";
import { ChevronLeft, ChevronRight, Settings, Trash2, X } from "lucide-react";
import { ExplainThisCard } from "@/components/ExplainThisCard";
import { insightsService } from "@/services/insightsService";

const PHASE_LABEL: Record<string, string> = {
  menstrual: "Menstrual", follicular: "Follicular", ovulation: "Ovulation", luteal: "Luteal",
};

// One restrained colour per phase, reused everywhere a phase is shown —
// menstrual keeps the existing brand maroon; follicular/ovulation/luteal
// reuse colours already established elsewhere in the app (amber for a
// lower-intensity phase, emerald for the fertile window, a lighter maroon
// tint for luteal) rather than introducing new hues.
const PHASE_CELL_CLASS: Record<string, string> = {
  menstrual: "bg-maroon-600 text-white border-maroon-600",
  follicular: "bg-amber-200 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 border-transparent",
  ovulation: "bg-emerald-500 dark:bg-emerald-600 text-white border-transparent",
  luteal: "bg-maroon-200 dark:bg-maroon-900/40 text-maroon-900 dark:text-maroon-200 border-transparent",
};
const PHASE_LEGEND: { phase: keyof typeof PHASE_CELL_CLASS; label: string }[] = [
  { phase: "menstrual", label: "Menstrual" },
  { phase: "follicular", label: "Follicular" },
  { phase: "ovulation", label: "Ovulation (fertile window)" },
  { phase: "luteal", label: "Luteal" },
];

const CONFIDENCE_LABEL: Record<CycleSummary["confidence"], string> = {
  high: "Consistent with your recent cycles",
  medium: "Still building a picture from your logs",
  low: "Low confidence — see note below",
};

// Adds `days` to a "YYYY-MM-DD" string, purely in local-calendar terms (no
// UTC parsing involved, unlike `new Date(iso)` + `.setDate()`, which can
// drift a day off in a browser whose local timezone isn't UTC).
function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return localDateISO(new Date(y, m - 1, d + days));
}

function formatDateRange(startISO: string, endISO: string): string {
  const start = new Date(startISO);
  const end = new Date(endISO);
  const startLabel = start.toLocaleDateString(undefined, { month: "long", day: "numeric" });
  const endLabel = end.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return startISO === endISO ? startLabel : `${startLabel} – ${endLabel}`;
}

const CONTRACEPTION_DISCLAIMER =
  "Not a birth control method — this is an estimate, not a reliable way to prevent or plan pregnancy.";

const SYMPTOM_OPTIONS = ["Cramps", "Fatigue", "Headache", "Bloating", "Tender breasts", "Backache"];
const MAX_SYMPTOMS = 30;
const MAX_SYMPTOM_LENGTH = 60;

// Once a woman has logged at least one entry, the backend fills in
// currentDay/phase/nextPeriodDate — this narrows those three fields so
// CycleRing/SeniorCycle never have to null-check them.
type PopulatedCycleSummary = CycleSummary & {
  currentDay: number;
  phase: Exclude<CycleSummary["phase"], null>;
  nextPeriodDate: string;
};

interface LogFormState {
  isPeriod: boolean;
  flow: "" | "spotting" | "light" | "medium" | "heavy";
  pain: number | null;
  mood: string;
  energy: number | null;
  symptoms: string[];
  notes: string;
}

function emptyLogForm(): LogFormState {
  return { isPeriod: false, flow: "", pain: null, mood: "", energy: null, symptoms: [], notes: "" };
}

function dayToLogForm(day: CycleDay): LogFormState {
  return {
    isPeriod: day.isPeriod,
    flow: day.flow ?? "",
    pain: day.pain ?? null,
    mood: day.mood ?? "",
    energy: day.energy ?? null,
    symptoms: day.symptoms ?? [],
    notes: day.notes ?? "",
  };
}

export default function CyclePage() {
  const { senior } = useApp();
  const [cycle, setCycle] = useState<CycleSummary | null>(null);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [confirmDeleteDate, setConfirmDeleteDate] = useState<string | null>(null);
  const [logForm, setLogForm] = useState<LogFormState>(emptyLogForm());
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [customSymptomInput, setCustomSymptomInput] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkDates, setBulkDates] = useState<string[]>(["", ""]);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const toast = useToast();

  useEffect(() => {
    cycleService.getSummary().then(setCycle);
  }, []);

  if (!cycle) return <LoadingState label="Loading your cycle" />;

  const hasData = cycle.currentDay !== null && cycle.phase !== null && cycle.nextPeriodDate !== null;
  const existingDay = editingDate ? cycle.history.find((d) => d.date === editingDate) : undefined;
  const isToday = editingDate === localDateISO();
  // Essentials-first logging: period/flow is the only mandatory field, and
  // pain/mood/energy/symptoms/notes stay tucked away unless the day already
  // has some (editing) or the woman actively wants to add more — daily
  // symptom tracking can itself become a source of anxiety, so nothing
  // beyond flow is asked for by default.
  const showDetails =
    detailsExpanded ||
    Boolean(existingDay?.pain !== undefined || existingDay?.energy !== undefined || existingDay?.mood || existingDay?.symptoms?.length || existingDay?.notes);

  function openLogModal(date: string) {
    const day = cycle!.history.find((d) => d.date === date);
    setLogForm(day ? dayToLogForm(day) : emptyLogForm());
    setDetailsExpanded(false);
    setCustomSymptomInput("");
    setEditingDate(date);
  }

  function toggleSymptom(symptom: string) {
    setLogForm((f) => ({
      ...f,
      symptoms: f.symptoms.includes(symptom) ? f.symptoms.filter((s) => s !== symptom) : [...f.symptoms, symptom],
    }));
  }

  function addCustomSymptom() {
    const value = customSymptomInput.trim();
    if (!value) return;
    if (value.length > MAX_SYMPTOM_LENGTH) {
      toast.show(`Keep symptoms under ${MAX_SYMPTOM_LENGTH} characters.`, { tone: "error" });
      return;
    }
    if (logForm.symptoms.length >= MAX_SYMPTOMS) {
      toast.show(`You can log up to ${MAX_SYMPTOMS} symptoms for one day.`, { tone: "error" });
      return;
    }
    if (logForm.symptoms.some((s) => s.toLowerCase() === value.toLowerCase())) {
      setCustomSymptomInput("");
      return;
    }
    setLogForm((f) => ({ ...f, symptoms: [...f.symptoms, value] }));
    setCustomSymptomInput("");
  }

  function removeSymptom(symptom: string) {
    setLogForm((f) => ({ ...f, symptoms: f.symptoms.filter((s) => s !== symptom) }));
  }

  function handleLog(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingDate) return;
    cycleService
      .logDay({
        date: editingDate,
        isPeriod: logForm.isPeriod,
        flow: logForm.flow || undefined,
        pain: logForm.pain ?? undefined,
        mood: logForm.mood.trim() || undefined,
        energy: logForm.energy ?? undefined,
        symptoms: logForm.symptoms,
        notes: logForm.notes.trim() || undefined,
      })
      .then(
        () => {
          // Re-fetch rather than hand-patch local state: logging the very
          // first entry changes currentDay/phase/nextPeriodDate too, not
          // just one day's history item.
          cycleService.getSummary().then(setCycle);
          setEditingDate(null);
          toast.show(existingDay ? "Cycle entry updated" : "Cycle entry saved");
        },
        (err) => toast.show(err instanceof Error ? err.message : "Couldn't save that entry. Please try again.", { tone: "error" })
      );
  }

  function logPeriodStartedToday() {
    cycleService.logDay({ date: localDateISO(), isPeriod: true, flow: "medium" }).then(
      () => {
        cycleService.getSummary().then(setCycle);
        toast.show("Period start logged for today");
      },
      (err) => toast.show(err instanceof Error ? err.message : "Couldn't log that. Please try again.", { tone: "error" })
    );
  }

  function openBulkAdd() {
    setBulkDates(["", ""]);
    setBulkOpen(true);
  }

  function updateBulkDate(i: number, value: string) {
    setBulkDates((d) => d.map((x, idx) => (idx === i ? value : x)));
  }

  function addBulkRow() {
    setBulkDates((d) => [...d, ""]);
  }

  function removeBulkRow(i: number) {
    setBulkDates((d) => d.filter((_, idx) => idx !== i));
  }

  async function handleBulkSave() {
    const today = localDateISO();
    const starts = Array.from(new Set(bulkDates.filter(Boolean)));
    if (starts.length === 0) {
      toast.show("Add at least one date.", { tone: "error" });
      return;
    }
    if (starts.some((d) => d > today)) {
      toast.show("Period start dates can't be in the future.", { tone: "error" });
      return;
    }
    setBulkSaving(true);
    try {
      // Marking only the start day is enough for cycle-length prediction
      // (that's derived from the gap between starts), but it's not enough
      // for period LENGTH or the calendar's phase colouring — both need to
      // know roughly how many days each period actually ran. Logging a
      // realistic run from each start (using the best period-length
      // estimate available right now) instead of one isolated day keeps
      // both honest; never logs into the future.
      const span = Math.max(1, Math.min(15, Math.round(cycle?.periodLength ?? 5)));
      const dates = starts.flatMap((start) =>
        Array.from({ length: span }, (_, i) => addDaysISO(start, i)).filter((d) => d <= today)
      );
      await Promise.all(dates.map((date) => cycleService.logDay({ date, isPeriod: true, flow: "medium" })));
      setCycle(await cycleService.getSummary());
      setBulkOpen(false);
      toast.show(`${starts.length} period ${starts.length === 1 ? "date" : "dates"} added`);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't save those dates. Please try again.", { tone: "error" });
    } finally {
      setBulkSaving(false);
    }
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

  const customSymptoms = logForm.symptoms.filter((s) => !SYMPTOM_OPTIONS.includes(s));

  const logModal = (
    <Modal open={editingDate !== null} onClose={() => setEditingDate(null)} title={modalTitle} size="sm">
      <form className="flex flex-col gap-4" onSubmit={handleLog}>
        <label className="flex items-center gap-2.5 text-sm font-medium senior:text-lg">
          <input
            type="checkbox"
            checked={logForm.isPeriod}
            onChange={(e) => setLogForm((f) => ({ ...f, isPeriod: e.target.checked }))}
            className="w-5 h-5 accent-[#6B1D30]"
          />
          Period day
        </label>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="flow" className="text-sm font-medium senior:text-lg">Flow</label>
          <select
            id="flow"
            value={logForm.flow}
            onChange={(e) => setLogForm((f) => ({ ...f, flow: e.target.value as LogFormState["flow"] }))}
            className="px-3.5 py-2.5 rounded border border-[var(--w360-border)] bg-[var(--w360-bg-raised)] text-[var(--w360-text)] text-sm senior:text-lg senior:py-3.5"
          >
            <option value="">None today</option>
            <option value="spotting">Spotting</option>
            <option value="light">Light</option>
            <option value="medium">Medium</option>
            <option value="heavy">Heavy</option>
          </select>
          {logForm.flow === "spotting" && (
            <p className="text-xs text-[var(--w360-text-muted)]">
              Spotting alone won't count as the start of a new period in your predictions.
            </p>
          )}
        </div>
        {showDetails ? (
          <>
            <ScalePicker label="Pain level (0–4)" value={logForm.pain} onChange={(v) => setLogForm((f) => ({ ...f, pain: v }))} />
            <ScalePicker label="Energy (0–4)" value={logForm.energy} onChange={(v) => setLogForm((f) => ({ ...f, energy: v }))} />
            <Input
              label="Mood (optional)"
              placeholder="e.g. irritable, calm, anxious"
              value={logForm.mood}
              onChange={(e) => setLogForm((f) => ({ ...f, mood: e.target.value }))}
              maxLength={60}
            />
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium senior:text-lg">Symptoms</span>
              <div className="grid grid-cols-2 gap-2">
                {SYMPTOM_OPTIONS.map((s) => (
                  <label key={s} className="flex items-center gap-2 text-sm senior:text-base">
                    <input
                      type="checkbox"
                      checked={logForm.symptoms.includes(s)}
                      onChange={() => toggleSymptom(s)}
                      className="w-4 h-4 accent-[#6B1D30]"
                    />
                    {s}
                  </label>
                ))}
              </div>
              {customSymptoms.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {customSymptoms.map((s) => (
                    <span
                      key={s}
                      className="inline-flex items-center gap-1 text-xs pl-2.5 pr-1.5 py-1 rounded-full bg-maroon-50 dark:bg-white/10 text-maroon-800 dark:text-maroon-200"
                    >
                      {s}
                      <button
                        type="button"
                        onClick={() => removeSymptom(s)}
                        aria-label={`Remove symptom ${s}`}
                        className="p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  value={customSymptomInput}
                  onChange={(e) => setCustomSymptomInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCustomSymptom();
                    }
                  }}
                  placeholder="Add another symptom"
                  maxLength={MAX_SYMPTOM_LENGTH}
                  className="flex-1 px-3 py-2 rounded border border-[var(--w360-border)] bg-[var(--w360-bg-raised)] text-[var(--w360-text)] text-sm senior:text-base"
                />
                <Button type="button" variant="secondary" size="sm" onClick={addCustomSymptom}>Add</Button>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="notes" className="text-sm font-medium senior:text-lg">Notes (optional)</label>
              <textarea
                id="notes"
                rows={2}
                value={logForm.notes}
                onChange={(e) => setLogForm((f) => ({ ...f, notes: e.target.value }))}
                className="px-3.5 py-2.5 rounded border border-[var(--w360-border)] bg-[var(--w360-bg-raised)] text-sm senior:text-lg"
              />
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setDetailsExpanded(true)}
            className="text-sm text-maroon-700 dark:text-maroon-300 font-medium text-left hover:underline senior:text-lg"
          >
            + Add pain, mood, energy, symptoms or a note (optional)
          </button>
        )}
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

  const bulkModal = (
    <Modal open={bulkOpen} onClose={() => setBulkOpen(false)} title="Add past periods" size="sm">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-[var(--w360-text-muted)] senior:text-base">
          Add the start dates of your last few periods and Women360 can predict your next one right away, instead of
          waiting for you to log two full cycles going forward. Each one logs a realistic run of days from that
          start, using your current period-length estimate — not just the single start day.
        </p>
        <div className="flex flex-col gap-2.5">
          {bulkDates.map((d, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="date"
                value={d}
                max={localDateISO()}
                onChange={(e) => updateBulkDate(i, e.target.value)}
                aria-label={`Period start date ${i + 1}`}
                className="flex-1 px-3.5 py-2.5 rounded border border-[var(--w360-border)] bg-[var(--w360-bg-raised)] text-[var(--w360-text)] text-sm senior:text-lg"
              />
              {bulkDates.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeBulkRow(i)}
                  aria-label="Remove this date"
                  className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950/40 text-[var(--w360-text-muted)] hover:text-red-600"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
        <Button type="button" variant="secondary" size="sm" className="w-fit" onClick={addBulkRow}>
          + Add another date
        </Button>
        <Button onClick={handleBulkSave} disabled={bulkSaving} size="lg">
          {bulkSaving ? "Saving…" : "Save dates"}
        </Button>
      </div>
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

  const settingsModal = <CycleSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} onSaved={() => cycleService.getSummary().then(setCycle)} />;

  if (!hasData) {
    return (
      <>
        <EmptyState
          title="Log your first entry to get started"
          description="Once you log a period, flow, or symptom, Women360 will start showing your cycle day, phase, and predictions here."
          action={
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <Button onClick={logPeriodStartedToday}>Period started today</Button>
              <Button variant="secondary" onClick={() => openLogModal(localDateISO())}>Log today's flow & symptoms</Button>
              <Button variant="secondary" onClick={openBulkAdd}>Add past periods instead</Button>
            </div>
          }
        />
        {logModal}
        {bulkModal}
        {deleteConfirm}
      </>
    );
  }

  const populated = cycle as PopulatedCycleSummary;

  if (senior.seniorMode) {
    return (
      <>
        <SeniorCycle cycle={populated} onPeriodToday={logPeriodStartedToday} onLog={() => openLogModal(localDateISO())} onBulkAdd={openBulkAdd} />
        {cycle.isLate && (
          <div className="max-w-xl mx-auto px-5">
            <ExplainThisCard
              title="Your period looks later than usual"
              fetchReport={() => insightsService.explainCycleDelay()}
            />
          </div>
        )}
        {logModal}
        {bulkModal}
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

      <CycleRing cycle={populated} onPeriodToday={logPeriodStartedToday} onLog={() => openLogModal(localDateISO())} onBulkAdd={openBulkAdd} onSettings={() => setSettingsOpen(true)} />

      {cycle.isLate && (
        <ExplainThisCard
          title="Your period looks later than usual"
          fetchReport={() => insightsService.explainCycleDelay()}
        />
      )}

      <Tabs
        tabs={[
          { id: "overview", label: "Overview", content: <OverviewTab cycle={cycle} /> },
          { id: "calendar", label: "Calendar", content: <MonthCalendar onSelectDay={openLogModal} /> },
          { id: "trends", label: "Trends", content: <TrendsTab cycle={cycle} /> },
        ]}
      />
      {logModal}
      {bulkModal}
      {deleteConfirm}
      {settingsModal}
    </div>
  );
}

function ScalePicker({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium senior:text-lg">{label}</span>
        {value !== null && (
          <button type="button" onClick={() => onChange(null)} className="text-xs text-maroon-700 dark:text-maroon-300 hover:underline">
            Clear
          </button>
        )}
      </div>
      <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label={label}>
        {[0, 1, 2, 3, 4].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            onClick={() => onChange(n)}
            className={`flex items-center justify-center rounded border py-2 text-sm font-semibold transition-colors senior:py-3 senior:text-base ${
              value === n
                ? "bg-maroon-700 border-maroon-700 text-white dark:bg-maroon-300 dark:border-maroon-300 dark:text-ink-900"
                : "border-[var(--w360-border)] hover:border-maroon-400 text-[var(--w360-text)]"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <p className="text-xs text-[var(--w360-text-muted)]" aria-live="polite">
        {value === null ? "Not recorded" : `${value} of 4`}
      </p>
    </div>
  );
}

function CycleRing({
  cycle, onPeriodToday, onLog, onBulkAdd, onSettings,
}: { cycle: PopulatedCycleSummary; onPeriodToday: () => void; onLog: () => void; onBulkAdd: () => void; onSettings: () => void }) {
  const size = 180;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  // Never over-fill the ring past a full circle once a period runs long —
  // lateness is communicated through the label below, not a broken ring.
  const pct = Math.min(100, (cycle.currentDay / cycle.cycleLength) * 100);
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
              className={`transition-[stroke-dashoffset] duration-700 ${cycle.isLate ? "stroke-amber-600 dark:stroke-amber-400" : "stroke-maroon-600 dark:stroke-maroon-300"}`}
              fill="none"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-display font-semibold tabular-nums">{cycle.currentDay}</span>
            <span className="text-xs text-[var(--w360-text-muted)] text-center px-2">
              {cycle.isLate ? `${cycle.daysLate} day${cycle.daysLate === 1 ? "" : "s"} late` : `of ${cycle.cycleLength} days`}
            </span>
          </div>
        </div>
        <div className="flex-1 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={cycle.isLate ? "warning" : "accent"}>
              {cycle.isLate ? "Period may be late" : `${PHASE_LABEL[cycle.phase]} phase`}
            </Badge>
            <Badge tone={cycle.confidence === "low" ? "neutral" : "accent"}>{CONFIDENCE_LABEL[cycle.confidence]}</Badge>
          </div>
          <p className="text-sm text-[var(--w360-text-muted)]">
            Next period expected{" "}
            <span className="font-medium text-[var(--w360-text)]">
              {cycle.nextPeriodRangeStart && cycle.nextPeriodRangeEnd
                ? formatDateRange(cycle.nextPeriodRangeStart, cycle.nextPeriodRangeEnd)
                : new Date(cycle.nextPeriodDate).toLocaleDateString(undefined, { month: "long", day: "numeric" })}
            </span>
            , based on your own recent cycles — a range, not an exact date.
          </p>
          {cycle.irregularityNote && (
            <p className="text-xs text-[var(--w360-text-muted)] bg-warmgrey-50 dark:bg-white/5 rounded px-2.5 py-2">
              {cycle.irregularityNote}
            </p>
          )}
          <p className="text-xs text-[var(--w360-text-muted)] italic">{CONTRACEPTION_DISCLAIMER}</p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Button variant="primary" size="sm" onClick={onPeriodToday}>Period started today</Button>
            <Button variant="secondary" size="sm" onClick={onLog}>Log today's flow & symptoms</Button>
            <Button variant="secondary" size="sm" onClick={onBulkAdd}>Add past periods</Button>
            <button
              type="button"
              onClick={onSettings}
              aria-label="Cycle settings"
              className="inline-flex items-center gap-1.5 text-sm text-[var(--w360-text-muted)] hover:text-[var(--w360-text)] px-2"
            >
              <Settings size={15} /> Settings
            </button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function OverviewTab({ cycle }: { cycle: CycleSummary }) {
  // history is newest-first from the API — take the most recent 7, then
  // reverse so the strip reads oldest-to-newest, left to right.
  const recent = [...cycle.history].slice(0, 7).reverse();
  const periodLengthIsLogged = cycle.loggedPeriodLength !== null;
  return (
    <div className="grid sm:grid-cols-3 gap-3">
      <Stat label="Average cycle length" value={`${cycle.cycleLength} days`} />
      <Stat
        label="Average period length"
        value={`${cycle.periodLength} days`}
        note={periodLengthIsLogged ? "from your logged periods" : "a starting estimate — log a period to refine it"}
      />
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

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function daysInMonth(monthStart: Date): number {
  return new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
}
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function MonthCalendar({ onSelectDay }: { onSelectDay: (date: string) => void }) {
  const [monthStart, setMonthStart] = useState(() => startOfMonth(new Date()));
  const [days, setDays] = useState<CycleDay[] | null>(null);
  const [phases, setPhases] = useState<CycleDayPhase[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const today = localDateISO();

  function load() {
    setDays(null);
    setPhases(null);
    setLoadError(false);
    const from = localDateISO(monthStart);
    const to = localDateISO(new Date(monthStart.getFullYear(), monthStart.getMonth(), daysInMonth(monthStart)));
    // Both must resolve before the grid renders — without a .catch, either
    // one failing silently (a real risk on a phone's network) left this
    // stuck on "Loading…" forever with no way to recover short of leaving
    // the tab and coming back.
    Promise.all([cycleService.listEntries(from, to), cycleService.getPhaseCalendar(from, to)])
      .then(([entries, calendar]) => {
        setDays(entries);
        setPhases(calendar.days);
      })
      .catch(() => setLoadError(true));
  }

  useEffect(load, [monthStart]);

  const dayByDate = new Map((days ?? []).map((d) => [d.date, d]));
  const phaseByDate = new Map((phases ?? []).map((p) => [p.date, p]));
  const total = daysInMonth(monthStart);
  const leadingBlanks = monthStart.getDay();
  const cells: ({ iso: string; entry?: CycleDay } | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: total }, (_, i) => {
      const iso = localDateISO(new Date(monthStart.getFullYear(), monthStart.getMonth(), i + 1));
      return { iso, entry: dayByDate.get(iso) };
    }),
  ];

  return (
    <Card>
      <CardBody className="pt-5">
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={() => setMonthStart((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
            aria-label="Previous month"
            className="p-2 rounded hover:bg-black/[0.05] dark:hover:bg-white/[0.08] text-[var(--w360-text-muted)]"
          >
            <ChevronLeft size={18} />
          </button>
          <p className="text-sm font-semibold senior:text-lg" aria-live="polite">
            {monthStart.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </p>
          <button
            type="button"
            onClick={() => setMonthStart((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
            aria-label="Next month"
            className="p-2 rounded hover:bg-black/[0.05] dark:hover:bg-white/[0.08] text-[var(--w360-text-muted)]"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        {loadError ? (
          <ErrorState title="Couldn't load this month" description="Check your connection and try again." onRetry={load} />
        ) : (
          <>
        <p className="text-sm text-[var(--w360-text-muted)] mb-4">
          Tap a day to log period, flow, pain, mood, energy, symptoms or a note. Colour shows the cycle phase — solid
          for a logged period, softer for an estimated phase.
        </p>
        <div className="grid grid-cols-7 gap-1.5 text-center mb-1.5">
          {WEEKDAY_LABELS.map((w) => (
            <span key={w} className="text-[10px] font-medium text-[var(--w360-text-muted)]">{w}</span>
          ))}
        </div>
        {days === null || phases === null ? (
          <div className="py-10 text-center text-sm text-[var(--w360-text-muted)]">Loading…</div>
        ) : (
          <div className="grid grid-cols-7 gap-1.5">
            {cells.map((cell, i) => {
              if (!cell) return <div key={`blank-${i}`} aria-hidden="true" />;
              const isFuture = cell.iso > today;
              const isToday = cell.iso === today;
              const d = cell.entry;
              const dayPhase = phaseByDate.get(cell.iso);
              // A logged period day is ground truth and always wins, even
              // when it's spotting-only (which the phase model excludes
              // from counting as a period) — it's still a real period day.
              const phase = d?.isPeriod ? "menstrual" : dayPhase?.phase ?? null;
              const isEstimated = d?.isPeriod ? false : dayPhase?.estimated !== false;
              const label = `${isToday ? "Today, " : ""}${new Date(cell.iso).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}${d?.isPeriod ? ", period day" : phase ? `, ${PHASE_LABEL[phase]} phase (estimated)` : ""}${d?.symptoms?.length ? `, symptoms: ${d.symptoms.join(", ")}` : ""}${isFuture ? " — not yet available to log" : " — tap to log or edit"}`;
              return (
                <button
                  key={cell.iso}
                  type="button"
                  disabled={isFuture}
                  onClick={() => onSelectDay(cell.iso)}
                  aria-label={label}
                  aria-current={isToday ? "date" : undefined}
                  className={`aspect-square rounded flex flex-col items-center justify-center text-xs gap-0.5 border transition-colors ${
                    isFuture
                      ? "border-transparent text-[var(--w360-text-muted)] opacity-40 cursor-not-allowed"
                      : phase
                        ? `${PHASE_CELL_CLASS[phase]} ${isEstimated ? "opacity-55 border-dashed" : ""}`
                        : "border-[var(--w360-border)] hover:border-maroon-400"
                  } ${isToday ? "ring-2 ring-offset-1 ring-maroon-400 dark:ring-offset-ink-900" : ""}`}
                >
                  <span className="font-medium">{new Date(cell.iso).getDate()}</span>
                  {d?.symptoms && d.symptoms.length > 0 && <span className="w-1 h-1 rounded-full bg-current opacity-70" />}
                </button>
              );
            })}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-4 pt-4 border-t border-[var(--w360-border)]">
          {PHASE_LEGEND.map((l) => (
            <span key={l.phase} className="flex items-center gap-1.5 text-xs text-[var(--w360-text-muted)]">
              <span className={`w-3 h-3 rounded-sm shrink-0 ${PHASE_CELL_CLASS[l.phase]}`} />
              {l.label}
            </span>
          ))}
          <span className="flex items-center gap-1.5 text-xs text-[var(--w360-text-muted)]">
            <span className="w-3 h-3 rounded-sm shrink-0 bg-maroon-600 border border-dashed border-maroon-800 opacity-55" />
            Estimated, not logged
          </span>
        </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}

function TrendsTab({ cycle }: { cycle: CycleSummary }) {
  const lengths = cycle.lastCycleLengths;
  const data = lengths.map((len, i) => ({ cycle: `C${i + 1}`, length: len }));

  let trendText: string;
  if (lengths.length < 3) {
    trendText = "Not enough logged cycles yet to describe a trend — this needs at least 3.";
  } else {
    const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const latest = lengths[lengths.length - 1];
    const diff = Math.round(latest - avg);
    const min = Math.min(...lengths);
    const max = Math.max(...lengths);
    const base = `Your last ${lengths.length} cycles have ranged from ${min} to ${max} days, averaging ${avg.toFixed(1)}`;
    trendText =
      Math.abs(diff) < 2
        ? `${base} — your latest cycle (${latest} days) is close to that average.`
        : diff > 0
          ? `${base} — your latest cycle (${latest} days) ran ${diff} day${diff === 1 ? "" : "s"} longer than that average.`
          : `${base} — your latest cycle (${latest} days) ran ${Math.abs(diff)} day${Math.abs(diff) === 1 ? "" : "s"} shorter than that average.`;
  }

  return (
    <div className="flex flex-col gap-4">
      {lengths.length >= 2 && (
        <Card>
          <CardBody className="pt-5">
            <p className="text-sm font-medium mb-4">Cycle length</p>
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
      )}
      {lengths.length < 3 ? (
        <EmptyState title="Not enough data yet" description={trendText} />
      ) : (
        <Card>
          <CardBody className="pt-5">
            <p className="text-sm">{trendText}</p>
            <p className="text-xs text-[var(--w360-text-muted)] mt-2">
              Women360 describes patterns in your own logged data here — never a diagnosis, just a nudge to pay
              attention if something shifts a lot.
            </p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <Card>
      <CardBody className="pt-5">
        <p className="text-xs text-[var(--w360-text-muted)]">{label}</p>
        <p className="text-2xl font-display font-semibold mt-1 tabular-nums">{value}</p>
        {note && <p className="text-[11px] text-[var(--w360-text-muted)] mt-0.5">{note}</p>}
      </CardBody>
    </Card>
  );
}

function SeniorCycle({ cycle, onPeriodToday, onLog, onBulkAdd }: { cycle: PopulatedCycleSummary; onPeriodToday: () => void; onLog: () => void; onBulkAdd: () => void }) {
  return (
    <div className="max-w-xl mx-auto p-5 flex flex-col gap-5">
      <Card>
        <CardBody className="pt-6 flex flex-col items-center text-center gap-3">
          <span className="font-display text-5xl font-semibold tabular-nums">{cycle.currentDay}</span>
          <p className="text-lg">
            {cycle.isLate
              ? `Your period looks about ${cycle.daysLate} day${cycle.daysLate === 1 ? "" : "s"} later than usual`
              : `Day ${cycle.currentDay} of your cycle`}
          </p>
          <p className="text-[var(--w360-text-muted)] text-lg">
            Next period expected{" "}
            {cycle.nextPeriodRangeStart && cycle.nextPeriodRangeEnd
              ? formatDateRange(cycle.nextPeriodRangeStart, cycle.nextPeriodRangeEnd)
              : new Date(cycle.nextPeriodDate).toLocaleDateString(undefined, { month: "long", day: "numeric" })}
          </p>
          {cycle.irregularityNote && <p className="text-base text-[var(--w360-text-muted)]">{cycle.irregularityNote}</p>}
          <p className="text-sm text-[var(--w360-text-muted)] italic">{CONTRACEPTION_DISCLAIMER}</p>
          <Button size="xl" fullWidth onClick={onPeriodToday}>Period started today</Button>
          <Button size="lg" variant="secondary" fullWidth onClick={onLog}>Add today's flow</Button>
          <Button size="lg" variant="secondary" fullWidth onClick={onBulkAdd}>Add past periods</Button>
        </CardBody>
      </Card>
    </div>
  );
}

function CycleSettingsModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [averageCycleLength, setAverageCycleLength] = useState("28");
  const [averagePeriodLength, setAveragePeriodLength] = useState("5");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    cycleService.getProfile().then((p) => {
      setAverageCycleLength(String(p.averageCycleLength));
      setAveragePeriodLength(String(p.averagePeriodLength));
    });
  }, [open]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const cycleLen = Number(averageCycleLength);
    const periodLen = Number(averagePeriodLength);
    const errs: Record<string, string> = {};
    if (!Number.isInteger(cycleLen) || cycleLen < 15 || cycleLen > 90) errs.cycleLen = "Enter a whole number of days between 15 and 90.";
    if (!Number.isInteger(periodLen) || periodLen < 1 || periodLen > 15) errs.periodLen = "Enter a whole number of days between 1 and 15.";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    try {
      await cycleService.upsertProfile({ averageCycleLength: cycleLen, averagePeriodLength: periodLen });
      onSaved();
      toast.show("Cycle settings saved");
      onClose();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't save cycle settings. Please try again.", { tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Cycle settings" size="sm">
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <p className="text-sm text-[var(--w360-text-muted)] senior:text-base">
          Used as a starting estimate until you've logged a few cycles of your own — after that, your own logged
          pattern takes over the prediction.
        </p>
        <Input
          label="Average cycle length (days)"
          type="number"
          min={15}
          max={90}
          value={averageCycleLength}
          onChange={(e) => setAverageCycleLength(e.target.value)}
          error={errors.cycleLen}
          required
        />
        <Input
          label="Average period length (days)"
          type="number"
          min={1}
          max={15}
          value={averagePeriodLength}
          onChange={(e) => setAveragePeriodLength(e.target.value)}
          error={errors.periodLen}
          required
        />
        <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save settings"}</Button>
      </form>
    </Modal>
  );
}
