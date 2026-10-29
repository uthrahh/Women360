import type { FormEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import { sleepService } from "@/services/sleepService";
import { localDateISO, to24Hour } from "@/services/mappers";
import { addDaysISO, defaultWakeDate, derivedBedDate, sleepSpanHours } from "@/lib/sleepSpan";
import { SLEEP_QUALITY_LABELS, type SleepEntry, type SleepSummary } from "@/types";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { LogPopover } from "@/components/ui/LogPopover";
import { Input } from "@/components/ui/Input";
import { ItemList } from "@/components/ui/ItemList";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LoadingState, EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/Toast";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { Moon, Sunrise, Plus } from "lucide-react";
import { Hint } from "@/components/ui/Hint";

interface SleepFormValues {
  bedDate: string; // the day she went to bed
  bedtime: string; // 24-hour "HH:MM"
  wakeDate: string; // the morning she woke; the night is filed under it
  wake: string; // 24-hour "HH:MM"
  /** She has picked a day herself, so changing the other day or the times no longer moves it. */
  bedDateChosen: boolean;
  wakeDateChosen: boolean;
  quality: number;
  notes: string;
}

const TOO_LONG_OR_BACKWARDS = "Waking up has to be after bedtime, and no more than 24 hours later.";

function emptyForm(): SleepFormValues {
  const today = localDateISO();
  return { bedDate: addDaysISO(today, -1), bedtime: "23:00", wakeDate: today, wake: "07:00", bedDateChosen: false, wakeDateChosen: false, quality: 3, notes: "" };
}

function entryToForm(e: SleepEntry): SleepFormValues {
  return { bedDate: e.bedDate, bedtime: to24Hour(e.bedtime), wakeDate: e.date, wake: to24Hour(e.wakeTime), bedDateChosen: true, wakeDateChosen: true, quality: e.quality, notes: e.notes ?? "" };
}

/**
 * The two days follow each other until she picks one. Choosing the day she went to bed puts the
 * wake day one day later when the night crosses midnight (and the same day when she went to bed
 * after it); choosing the wake day puts the bed day just before it. Changing a time keeps the day
 * she picked and moves the other one.
 */
type Changed = "bedDate" | "wakeDate" | "time";
function reconcile(form: SleepFormValues, change: Partial<Pick<SleepFormValues, "bedDate" | "bedtime" | "wakeDate" | "wake">>, changed: Changed): SleepFormValues {
  const next: SleepFormValues = { ...form, ...change };
  if (changed === "bedDate") next.bedDateChosen = true;
  if (changed === "wakeDate") next.wakeDateChosen = true;
  if (next.bedDateChosen && !next.wakeDateChosen) next.wakeDate = defaultWakeDate(next.bedDate, next.bedtime, next.wake);
  else if (!next.bedDateChosen) next.bedDate = derivedBedDate(next.wakeDate, next.bedtime, next.wake);
  return next;
}

export default function SleepPage() {
  const [data, setData] = useState<SleepSummary | null>(null);
  const [editingEntry, setEditingEntry] = useState<SleepEntry | "new" | null>(null);
  const [form, setForm] = useState<SleepFormValues>(emptyForm());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SleepEntry | null>(null);
  const toast = useToast();

  useEffect(() => {
    sleepService.getSummary().then(setData);
  }, []);

  if (!data) return <LoadingState label="Loading sleep" />;

  function openAdd() {
    setForm(emptyForm());
    setError("");
    setEditingEntry("new");
  }

  function openEdit(entry: SleepEntry) {
    setForm(entryToForm(entry));
    setError("");
    setEditingEntry(entry);
  }

  const previewHours = sleepSpanHours(form.bedDate, form.bedtime, form.wakeDate, form.wake);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form.bedDate || !form.wakeDate) {
      setError("Choose both days.");
      return;
    }
    if (previewHours === null) {
      setError(TOO_LONG_OR_BACKWARDS);
      return;
    }
    setError("");
    setSaving(true);
    try {
      await sleepService.logEntry({
        bedDate: form.bedDate,
        bedtime24: form.bedtime,
        wakeDate: form.wakeDate,
        wake24: form.wake,
        quality: form.quality,
        notes: form.notes.trim() || undefined,
      });
      const refreshed = await sleepService.getSummary();
      setData(refreshed);
      toast.show(editingEntry === "new" ? "Sleep logged" : "Sleep record updated");
      setEditingEntry(null);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't save that entry. Please try again.", { tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await sleepService.deleteEntry(deleteTarget.date);
      const refreshed = await sleepService.getSummary();
      setData(refreshed);
      toast.show("Sleep record deleted");
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't delete that entry. Please try again.", { tone: "error" });
    } finally {
      setDeleteTarget(null);
    }
  }

  const sleepForm = (
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-sm font-medium senior:text-lg mb-1">Went to bed</legend>
          <div className="grid grid-cols-[3fr_2fr] gap-3">
            <Input aria-label="Went to bed, day" type="date" value={form.bedDate} max={form.wakeDate} onChange={(e) => setForm((f) => reconcile(f, { bedDate: e.target.value }, "bedDate"))} required />
            <Input aria-label="Went to bed, time" type="time" value={form.bedtime} onChange={(e) => setForm((f) => reconcile(f, { bedtime: e.target.value }, "time"))} required />
          </div>
        </fieldset>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-sm font-medium senior:text-lg mb-1">Woke up</legend>
          <div className="grid grid-cols-[3fr_2fr] gap-3">
            <Input
              aria-label="Woke up, day"
              type="date"
              value={form.wakeDate}
              min={form.bedDate}
              max={localDateISO()}
              onChange={(e) => setForm((f) => reconcile(f, { wakeDate: e.target.value }, "wakeDate"))}
              disabled={editingEntry !== "new"}
              required
            />
            <Input aria-label="Woke up, time" type="time" value={form.wake} onChange={(e) => setForm((f) => reconcile(f, { wake: e.target.value }, "time"))} required />
          </div>
        </fieldset>
        {error || previewHours === null ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error || TOO_LONG_OR_BACKWARDS}</p>
        ) : (
          <p className="text-sm text-[var(--w360-text-muted)]">Duration: <span className="font-medium text-[var(--w360-text)]">{previewHours}h</span></p>
        )}
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-sm font-medium senior:text-lg mb-1">Sleep quality</legend>
          <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Sleep quality, 1 to 5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={form.quality === n}
                onClick={() => setForm((f) => ({ ...f, quality: n }))}
                className={`flex flex-col items-center justify-center gap-0.5 rounded border py-2.5 text-sm font-semibold transition-colors senior:py-3.5 senior:text-base ${
                  form.quality === n
                    ? "bg-maroon-700 border-maroon-700 text-white dark:bg-maroon-300 dark:border-maroon-300 dark:text-ink-900"
                    : "border-[var(--w360-border)] hover:border-maroon-400 text-[var(--w360-text)]"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="text-xs text-[var(--w360-text-muted)] senior:text-sm" aria-live="polite">
            {form.quality} — {SLEEP_QUALITY_LABELS[form.quality]}
          </p>
          <Hint id="sleep-rating" className="text-xs text-[var(--w360-text-muted)] italic">
            This is your own rating — trust how you actually feel over any number.
          </Hint>
        </fieldset>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="sleep-notes" className="text-sm font-medium">Notes (optional)</label>
          <textarea
            id="sleep-notes"
            rows={2}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            className="px-3.5 py-2.5 rounded border border-[var(--w360-border)] bg-[var(--w360-bg-raised)] text-[var(--w360-text)] text-sm senior:text-lg"
          />
        </div>
        <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        {editingEntry !== null && editingEntry !== "new" && (
          <Button
            type="button"
            variant="danger"
            onClick={() => {
              setDeleteTarget(editingEntry);
              setEditingEntry(null);
            }}
          >
            Delete this record
          </Button>
        )}
      </form>
  );

  const logModal = (
    <Modal open={editingEntry !== null && editingEntry !== "new"} onClose={() => setEditingEntry(null)} title="Edit sleep record" size="sm">
      {sleepForm}
    </Modal>
  );

  const logPopover = (
    <LogPopover
      open={editingEntry === "new"}
      onOpenChange={(o) => (o ? openAdd() : setEditingEntry(null))}
      triggerLabel="Log sleep"
      triggerIcon={<Plus size={16} />}
      title="Log sleep"
    >
      {sleepForm}
    </LogPopover>
  );

  if (data.history.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-3xl font-semibold">Sleep</h1>
          <p className="text-[var(--w360-text-muted)] mt-1">How well you're resting and recovering.</p>
        </div>
        <EmptyState
          title="No sleep logged yet"
          description="Log tonight's bedtime and wake time to start tracking your sleep."
          action={logPopover}
        />
        {logModal}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Sleep</h1>
          <p className="text-[var(--w360-text-muted)] mt-1">How well you're resting and recovering.</p>
        </div>
        {logPopover}
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <Stat icon={<Moon size={16} />} label="Last night" value={`${data.durationHours}h`} />
        <Stat icon={<Sunrise size={16} />} label="Wake time" value={data.wakeTime} />
        <Stat label="Sleep quality" value={data.quality ? `${data.quality}/5 · ${SLEEP_QUALITY_LABELS[data.quality]}` : "Not rated"} />
      </div>

      <Card>
        <CardBody className="pt-5">
          <p className="text-sm font-medium mb-1">This week</p>
          <p className="text-xs text-[var(--w360-text-muted)]">Bedtime {data.bedtime} · Consistency {data.consistencyScore}%</p>
          <p className="text-[11px] text-[var(--w360-text-muted)] italic mb-4">
            How regular your bedtime has been — not a judgment of your sleep quality.
          </p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.weeklyHours}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--w360-border)" vertical={false} />
                <XAxis dataKey="day" stroke="var(--w360-text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--w360-text-muted)" fontSize={12} tickLine={false} axisLine={false} domain={[0, 9]} />
                <Tooltip contentStyle={{ background: "var(--w360-bg-raised)", border: "1px solid var(--w360-border)", borderRadius: 8, fontSize: 13 }} />
                <Line type="monotone" dataKey="hours" stroke="#6B1D30" strokeWidth={2.5} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>

      <section>
        <h2 className="font-display text-lg font-semibold mb-3">Recent nights</h2>
        <Hint id="sleep-select" className="text-xs text-[var(--w360-text-muted)] mb-2">Select a night to edit or delete it.</Hint>
        <ItemList
          ariaLabel="Recent nights"
          items={data.history.map((entry) => ({
            id: entry.id,
            entry,
            title: new Date(entry.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
            description: [
              `${entry.bedtime} → ${entry.wakeTime} · ${entry.durationHours}h · ${entry.quality}/5 ${SLEEP_QUALITY_LABELS[entry.quality]}`,
              entry.notes,
            ]
              .filter(Boolean)
              .join(" · "),
          }))}
          maxHeight={460}
          onItemSelect={(row) => openEdit(row.entry)}
        />
      </section>

      {logModal}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete this sleep record?"
        description={deleteTarget ? `The record for ${new Date(deleteTarget.date).toLocaleDateString()} will be removed.` : undefined}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function Stat({ icon, label, value }: { icon?: ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardBody className="pt-5">
        <div className="flex items-center gap-1.5 text-[var(--w360-text-muted)] text-xs mb-1">{icon}{label}</div>
        <p className="text-2xl font-display font-semibold tabular-nums">{value}</p>
      </CardBody>
    </Card>
  );
}
