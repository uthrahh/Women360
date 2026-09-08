import type { FormEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import { sleepService } from "@/services/sleepService";
import { calcSleepDuration, localDateISO, to24Hour } from "@/services/mappers";
import { SLEEP_QUALITY_LABELS, type SleepEntry, type SleepSummary } from "@/types";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LoadingState, EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/Toast";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { Moon, Sunrise, Plus, Pencil, Trash2 } from "lucide-react";

interface SleepFormValues {
  date: string;
  bedtime: string; // 24-hour "HH:MM"
  wake: string; // 24-hour "HH:MM"
  quality: number;
  notes: string;
}

function emptyForm(): SleepFormValues {
  return { date: localDateISO(), bedtime: "23:00", wake: "07:00", quality: 3, notes: "" };
}

function entryToForm(e: SleepEntry): SleepFormValues {
  return { date: e.date, bedtime: to24Hour(e.bedtime), wake: to24Hour(e.wakeTime), quality: e.quality, notes: e.notes ?? "" };
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

  const previewHours = calcSleepDuration(form.bedtime, form.wake);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form.date) {
      setError("Choose a date.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await sleepService.logEntry(form.date, {
        bedtime24: form.bedtime,
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

  const logModal = (
    <Modal open={editingEntry !== null} onClose={() => setEditingEntry(null)} title={editingEntry === "new" ? "Log sleep" : "Edit sleep record"} size="sm">
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <Input
          label="Date"
          type="date"
          value={form.date}
          onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
          max={localDateISO()}
          error={error || undefined}
          disabled={editingEntry !== "new"}
          required
        />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Bedtime" type="time" value={form.bedtime} onChange={(e) => setForm((f) => ({ ...f, bedtime: e.target.value }))} required />
          <Input label="Wake time" type="time" value={form.wake} onChange={(e) => setForm((f) => ({ ...f, wake: e.target.value }))} required />
        </div>
        <p className="text-sm text-[var(--w360-text-muted)]">Duration: <span className="font-medium text-[var(--w360-text)]">{previewHours}h</span></p>
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
      </form>
    </Modal>
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
          action={<Button onClick={openAdd}><Plus size={16} /> Log sleep</Button>}
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
        <Button onClick={openAdd}><Plus size={16} /> Log sleep</Button>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <Stat icon={<Moon size={16} />} label="Last night" value={`${data.durationHours}h`} />
        <Stat icon={<Sunrise size={16} />} label="Wake time" value={data.wakeTime} />
        <Stat label="Sleep quality" value={data.quality ? `${data.quality}/5 · ${SLEEP_QUALITY_LABELS[data.quality]}` : "Not rated"} />
      </div>

      <Card>
        <CardBody className="pt-5">
          <p className="text-sm font-medium mb-1">This week</p>
          <p className="text-xs text-[var(--w360-text-muted)] mb-4">Bedtime {data.bedtime} · Consistency {data.consistencyScore}%</p>
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
        <Card>
          <CardBody className="p-0 divide-y divide-[var(--w360-border)]">
            {data.history.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {new Date(entry.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                  </p>
                  <p className="text-xs text-[var(--w360-text-muted)] mt-0.5">
                    {entry.bedtime} → {entry.wakeTime} · {entry.durationHours}h · {entry.quality}/5 {SLEEP_QUALITY_LABELS[entry.quality]}
                  </p>
                  {entry.notes && <p className="text-xs text-[var(--w360-text-muted)] mt-0.5">{entry.notes}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => openEdit(entry)}
                    aria-label={`Edit sleep record for ${entry.date}`}
                    className="p-1.5 rounded hover:bg-black/[0.05] dark:hover:bg-white/[0.08] text-[var(--w360-text-muted)]"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(entry)}
                    aria-label={`Delete sleep record for ${entry.date}`}
                    className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950/40 text-[var(--w360-text-muted)] hover:text-red-600"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
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
