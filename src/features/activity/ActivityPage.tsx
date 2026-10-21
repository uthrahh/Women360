import { useEffect, useState } from "react";
import { activityService } from "@/services/activityService";
import { cycleService } from "@/services/cycleService";
import type { ActivityEntry, ActivitySummary, CycleSummary, QuickLogItem } from "@/types";
import { Card, CardBody } from "@/components/ui/Card";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { LogPopover } from "@/components/ui/LogPopover";
import { Input } from "@/components/ui/Input";
import { ItemList } from "@/components/ui/ItemList";
import { NumberField } from "@/components/ui/NumberField";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LoadingState, EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/Toast";
import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip } from "recharts";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { localDateISO } from "@/services/mappers";

/** A small inline form to add one of her own shortcuts: what, how long, how hard. */
function QuickLogAdder({ onAdd }: { onAdd: (v: { type: string; duration: number; intensity: ActivityEntry["intensity"] }) => Promise<boolean> }) {
  const [type, setType] = useState("");
  const [duration, setDuration] = useState("");
  const [intensity, setIntensity] = useState<ActivityEntry["intensity"]>("moderate");
  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded-2xl border border-[var(--w360-border)] bg-[var(--w360-bg-warm)] p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const minutes = Number(duration);
        if (!type.trim() || !(minutes >= 1)) return;
        if (await onAdd({ type: type.trim(), duration: minutes, intensity })) {
          setType("");
          setDuration("");
        }
      }}
    >
      <Input label="New shortcut" value={type} onChange={(e) => setType(e.target.value)} placeholder="e.g. Swim" required />
      <NumberField label="Duration" suffix="min" min={1} max={600} startAt={30} value={duration} onChange={setDuration} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="quick-intensity" className="text-sm font-medium">Intensity</label>
        <select
          id="quick-intensity"
          value={intensity}
          onChange={(e) => setIntensity(e.target.value as ActivityEntry["intensity"])}
          className="px-3.5 py-2.5 rounded border border-[var(--w360-border)] bg-[var(--w360-bg-raised)] text-sm"
        >
          <option value="low">Low</option>
          <option value="moderate">Moderate</option>
          <option value="high">High</option>
        </select>
      </div>
      <Button type="submit" size="sm" disabled={!type.trim() || !duration}>Add to quick log</Button>
    </form>
  );
}

type Prefill = { type: string; duration: number; intensity: QuickLogItem["intensity"] };
type FormValues = { type: string; duration: number; intensity: ActivityEntry["intensity"]; notes: string; day: string; addToQuickLog: boolean };

/** The activity form. Shared by "Add activity" and by editing an entry. */
function ActivityForm({
  entry,
  prefill,
  submitLabel,
  onSubmit,
  offerQuickLog,
}: {
  entry?: ActivityEntry;
  prefill?: Prefill | null;
  submitLabel: string;
  onSubmit: (values: FormValues) => void;
  offerQuickLog?: boolean;
}) {
  const toast = useToast();
  const initial = entry ?? prefill;
  const [duration, setDuration] = useState(initial ? String(initial.duration) : "");
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const minutes = Number(duration);
        if (!(minutes >= 1)) {
          toast.show("Enter how many minutes it lasted.", { tone: "error" });
          return;
        }
        onSubmit({
          type: String(form.get("type") ?? "").trim() || "Activity",
          duration: minutes,
          intensity: String(form.get("intensity") ?? "moderate") as ActivityEntry["intensity"],
          notes: String(form.get("notes") ?? "").trim(),
          day: String(form.get("day") ?? "") || localDateISO(),
          addToQuickLog: form.get("addToQuickLog") === "on",
        });
      }}
    >
      <Input label="Activity type" name="type" defaultValue={initial?.type ?? ""} placeholder="e.g. Brisk walk" required />
      <NumberField name="duration" label="Duration" suffix="min" min={1} max={600} startAt={30} value={duration} onChange={setDuration} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="intensity" className="text-sm font-medium">Intensity</label>
        <select
          id="intensity"
          name="intensity"
          defaultValue={initial?.intensity ?? "moderate"}
          className="px-3.5 py-2.5 rounded border border-[var(--w360-border)] bg-[var(--w360-bg-raised)] text-[var(--w360-text)] text-sm senior:text-lg senior:py-3.5"
        >
          <option value="low">Low</option>
          <option value="moderate">Moderate</option>
          <option value="high">High</option>
        </select>
      </div>
      {entry && (
        <>
          <Input label="Day" name="day" type="date" defaultValue={entry.day} max={localDateISO()} required />
          <Input label="Notes" name="notes" defaultValue={entry.notes ?? ""} placeholder="Optional" />
        </>
      )}
      {offerQuickLog && (
        <label className="flex items-center gap-2 text-sm senior:text-base">
          <input type="checkbox" name="addToQuickLog" className="w-4 h-4 accent-[var(--w360-accent)]" />
          Also add this to my quick log
        </label>
      )}
      <Button type="submit">{submitLabel}</Button>
    </form>
  );
}

export default function ActivityPage() {
  const [data, setData] = useState<ActivitySummary | null>(null);
  const [cycle, setCycle] = useState<CycleSummary | null>(null);
  const [quick, setQuick] = useState<QuickLogItem[] | null>(null);
  const [customising, setCustomising] = useState(false);
  const [busyChip, setBusyChip] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [prefill, setPrefill] = useState<Prefill | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<ActivityEntry | null>(null);
  const [detail, setDetail] = useState<ActivityEntry | null>(null);
  const [editing, setEditing] = useState(false);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);
  const toast = useToast();

  const reload = () => activityService.getSummary().then(setData);

  useEffect(() => {
    reload();
    cycleService.getSummary().then(setCycle);
    activityService.listQuickLog().then(setQuick).catch(() => setQuick([]));
  }, []);

  if (!data) return <LoadingState label="Loading activity" />;

  const fail = (err: unknown, fallback: string) => toast.show(err instanceof Error ? err.message : fallback, { tone: "error" });

  function openAdd(template?: Prefill) {
    setPrefill(template ?? null);
    setFormKey((k) => k + 1);
    setAddOpen(true);
  }

  // One tap on a quick-log chip is the whole action: it logs today, no form.
  async function logQuick(item: QuickLogItem) {
    if (busyChip) return;
    setBusyChip(item.id);
    try {
      await activityService.logActivity({ type: item.type, duration: item.duration, intensity: item.intensity });
      await reload();
      toast.show(`Logged ${item.label}`);
    } catch (err) {
      fail(err, "Could not log that. Please try again.");
    } finally {
      setBusyChip(null);
    }
  }

  async function removeQuick(item: QuickLogItem) {
    try {
      await activityService.removeQuickLog(item.id);
      setQuick((q) => (q ? q.filter((x) => x.id !== item.id) : q));
    } catch (err) {
      fail(err, "Could not remove that.");
    }
  }

  async function addQuick(v: { type: string; duration: number; intensity: ActivityEntry["intensity"] }) {
    try {
      const created = await activityService.addQuickLog({
        label: `${v.duration}-min ${v.type.toLowerCase()}`,
        type: v.type,
        duration: v.duration,
        intensity: v.intensity,
      });
      setQuick((q) => (q ? [...q, created] : [created]));
      return true;
    } catch (err) {
      fail(err, "Could not add that to your quick log.");
      return false;
    }
  }

  async function handleAdd(v: FormValues) {
    try {
      await activityService.logActivity({ type: v.type, duration: v.duration, intensity: v.intensity });
      if (v.addToQuickLog) await addQuick(v);
      await reload();
      setAddOpen(false);
      toast.show("Activity logged");
    } catch (err) {
      fail(err, "Could not save that. Please try again.");
    }
  }

  async function handleEdit(v: FormValues) {
    if (!detail) return;
    try {
      await activityService.updateEntry(detail.id, { type: v.type, duration: v.duration, intensity: v.intensity, notes: v.notes, day: v.day });
      await reload();
      setDetail(null);
      setEditing(false);
      toast.show("Activity updated");
    } catch (err) {
      fail(err, "Could not save that. Please try again.");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    try {
      await activityService.deleteEntry(id);
      await reload();
      toast.show("Activity entry deleted");
    } catch (err) {
      fail(err, "Could not delete that entry. Please try again.");
    } finally {
      setDeleteTarget(null);
    }
  }

  const activityForm = <ActivityForm key={formKey} prefill={prefill} submitLabel="Save activity" onSubmit={handleAdd} offerQuickLog />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">Activity</h1>
          <p className="text-[var(--w360-text-muted)] mt-1">Steps, workouts and movement, all in one place.</p>
        </div>
        <LogPopover
          open={addOpen}
          onOpenChange={(o) => (o ? openAdd() : setAddOpen(false))}
          triggerLabel="Add activity"
          triggerIcon={<Plus size={16} />}
          title="Add activity"
        >
          {activityForm}
        </LogPopover>
      </div>

      <section aria-label="Quick log" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[var(--w360-text-muted)]">Quick log, one tap adds it for today:</span>
          {quick?.map((t) => (
            <span key={t.id} className="inline-flex items-stretch">
              <button
                type="button"
                disabled={busyChip !== null}
                onClick={() => logQuick(t)}
                className={`text-xs px-3 py-1.5 border border-[var(--w360-border)] hover:border-maroon-400 hover:text-maroon-700 dark:hover:text-maroon-300 transition-colors senior:text-sm disabled:opacity-50 ${customising ? "rounded-l-full" : "rounded-full"}`}
              >
                {busyChip === t.id ? "Logging..." : t.label}
              </button>
              {customising && (
                <button
                  type="button"
                  onClick={() => removeQuick(t)}
                  aria-label={`Remove ${t.label} from quick log`}
                  className="px-2 rounded-r-full border border-l-0 border-[var(--w360-border)] text-[var(--w360-text-muted)] hover:text-red-600 hover:border-red-300"
                >
                  <X size={12} />
                </button>
              )}
            </span>
          ))}
          {quick && quick.length === 0 && !customising && (
            <span className="text-xs text-[var(--w360-text-muted)]">Nothing here yet.</span>
          )}
          <button
            type="button"
            onClick={() => setCustomising((c) => !c)}
            aria-pressed={customising}
            className="text-xs px-2.5 py-1.5 rounded-full text-[var(--w360-accent)] hover:underline inline-flex items-center gap-1 senior:text-sm"
          >
            {customising ? "Done" : (<><Pencil size={12} /> Edit</>)}
          </button>
        </div>
        {customising && <QuickLogAdder onAdd={addQuick} />}
      </section>

      {cycle?.phase === "menstrual" && !suggestionDismissed && (
        <Card>
          <CardBody className="pt-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium senior:text-base">Lower-intensity days can feel better right now</p>
              <p className="text-xs text-[var(--w360-text-muted)] mt-0.5">
                Just a suggestion based on your cycle — a walk, stretch or yoga session, or skip it entirely.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="secondary" size="sm" onClick={() => openAdd(quick?.find((q) => q.intensity === "low"))}>Log something gentle</Button>
              <button
                onClick={() => setSuggestionDismissed(true)}
                aria-label="Dismiss this suggestion"
                className="p-1.5 rounded hover:bg-black/[0.05] dark:hover:bg-white/[0.08] text-[var(--w360-text-muted)]"
              >
                <X size={16} />
              </button>
            </div>
          </CardBody>
        </Card>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <Card>
          <CardBody className="flex items-center gap-5 pt-5">
            <ProgressRing value={(data.steps / data.stepsGoal) * 100} size={80} label={`${Math.round((data.steps / data.stepsGoal) * 100)}%`} />
            <div>
              <p className="text-sm text-[var(--w360-text-muted)]">Steps today</p>
              <p className="text-2xl font-display font-semibold tabular-nums">{data.steps.toLocaleString()}</p>
              <p className="text-xs text-[var(--w360-text-muted)]">Goal: {data.stepsGoal.toLocaleString()}</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-5 pt-5">
            <ProgressRing value={(data.activeMinutes / data.activeMinutesGoal) * 100} size={80} label={`${data.activeMinutes}m`} />
            <div>
              <p className="text-sm text-[var(--w360-text-muted)]">Active minutes</p>
              <p className="text-2xl font-display font-semibold tabular-nums">{data.activeMinutes} min</p>
              <p className="text-xs text-[var(--w360-text-muted)]">Goal: {data.activeMinutesGoal} min</p>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody className="pt-5">
          <p className="text-sm font-medium mb-3">This week</p>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.weeklyMinutes}>
                <XAxis dataKey="day" stroke="var(--w360-text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "var(--w360-bg-raised)", border: "1px solid var(--w360-border)", borderRadius: 8, fontSize: 13 }} />
                <Bar dataKey="minutes" fill="#6B1D30" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>

      <section>
        <h2 className="font-display text-lg font-semibold mb-3">Recent activity</h2>
        {data.entries.length === 0 ? (
          <EmptyState title="No activity logged yet" description="Log a workout or walk to see it here." />
        ) : (
          <>
            <p className="text-xs text-[var(--w360-text-muted)] mb-2">Select an entry to edit or delete it.</p>
            <ItemList
              maxHeight={460}
              items={data.entries.map((e) => ({
                id: e.id,
                entry: e,
                title: e.type,
                description: [e.date, e.notes].filter(Boolean).join(" · "),
                meta: `${e.duration} min · ${e.intensity}`,
              }))}
              onItemSelect={(row) => setDetail(row.entry)}
            />
          </>
        )}
      </section>

      <Modal open={detail !== null} onClose={() => { setDetail(null); setEditing(false); }} title={editing ? "Edit activity" : (detail?.type ?? "Activity")} size="sm">
        {detail && editing && (
          <ActivityForm entry={detail} submitLabel="Save changes" onSubmit={handleEdit} />
        )}
        {detail && !editing && (
          <div className="flex flex-col gap-4">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-[var(--w360-text-muted)]">When</dt>
              <dd>{detail.date}</dd>
              <dt className="text-[var(--w360-text-muted)]">Duration</dt>
              <dd className="tabular-nums">{detail.duration} min</dd>
              <dt className="text-[var(--w360-text-muted)]">Intensity</dt>
              <dd className="capitalize">{detail.intensity}</dd>
              {detail.notes && (
                <>
                  <dt className="text-[var(--w360-text-muted)]">Notes</dt>
                  <dd>{detail.notes}</dd>
                </>
              )}
            </dl>
            <Button type="button" variant="secondary" onClick={() => setEditing(true)}>
              <Pencil size={15} /> Edit this entry
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() => {
                setDeleteTarget(detail);
                setDetail(null);
              }}
            >
              <Trash2 size={15} /> Delete this entry
            </Button>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete this activity entry?"
        description={deleteTarget ? `"${deleteTarget.type}" will be removed.` : undefined}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
