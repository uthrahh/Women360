import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip } from "recharts";
import { Check, Flame, Pencil, Plus, Trash2, X } from "lucide-react";
import { activityService } from "@/services/activityService";
import { cycleService } from "@/services/cycleService";
import { habitService } from "@/services/habitService";
import { localDateISO } from "@/services/mappers";
import { effortOf, emptyFields, formatDuration, shortcutKey, type FieldsValue } from "@/lib/activity";
import type { ActivityCatalog, ActivityEntry, ActivitySummary, CycleSummary, Effort, Habit, QuickLogItem } from "@/types";
import { Card, CardBody } from "@/components/ui/Card";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { LogPopover } from "@/components/ui/LogPopover";
import { Input } from "@/components/ui/Input";
import { ItemList } from "@/components/ui/ItemList";
import { NumberField } from "@/components/ui/NumberField";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/Toast";
import { ActivityFields } from "./ActivityFields";
import { ActivityHabits } from "./ActivityHabits";

interface FormValues {
  activityCode: string;
  effort: Effort;
  minutes: number;
  distanceKm: number | null;
  sets: number | null;
  notes: string;
  day: string;
  addToQuickLog: boolean;
}

const fieldsOf = (e: ActivityEntry): FieldsValue => ({
  code: e.activityCode === "other" ? "" : e.activityCode,
  effort: e.intensity,
  minutes: e.duration,
  distance: e.distanceKm !== undefined ? String(e.distanceKm) : "",
  sets: e.sets !== undefined ? String(e.sets) : "",
});

/** The form for a new activity and for editing one: the same fields either way. */
function ActivityForm({
  catalog,
  weightKg,
  entry,
  prefill,
  quickKeys,
  submitLabel,
  onSubmit,
  offerQuickLog,
}: {
  catalog: ActivityCatalog;
  weightKg: number | null;
  entry?: ActivityEntry;
  prefill?: FieldsValue | null;
  quickKeys: Set<string>;
  submitLabel: string;
  onSubmit: (values: FormValues) => void;
  offerQuickLog?: boolean;
}) {
  const toast = useToast();
  const [fields, setFields] = useState<FieldsValue>(entry ? fieldsOf(entry) : prefill ?? emptyFields());
  const [notes, setNotes] = useState(entry?.notes ?? "");
  const [day, setDay] = useState(entry?.day ?? localDateISO());
  const [addToQuickLog, setAddToQuickLog] = useState(false);

  const complete = fields.code !== "" && fields.effort !== "" && !!fields.minutes;
  const alreadyQuick = complete && quickKeys.has(shortcutKey(fields.code, fields.minutes!, fields.effort as Effort));

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!fields.code) return toast.show("Choose an activity.", { tone: "error" });
        if (!fields.minutes) return toast.show("Enter how long it lasted.", { tone: "error" });
        onSubmit({
          activityCode: fields.code,
          effort: fields.effort as Effort,
          minutes: fields.minutes,
          distanceKm: fields.distance !== "" ? Number(fields.distance) : null,
          sets: fields.sets !== "" ? Number(fields.sets) : null,
          notes: notes.trim(),
          day,
          addToQuickLog: addToQuickLog && !alreadyQuick,
        });
      }}
    >
      <ActivityFields catalog={catalog} weightKg={weightKg} value={fields} onChange={setFields} idPrefix={entry ? "edit" : "add"} />
      {entry && (
        <>
          <Input label="Day" type="date" value={day} max={localDateISO()} onChange={(e) => setDay(e.target.value)} required />
          <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" maxLength={500} />
        </>
      )}
      {offerQuickLog && (
        <label className={`flex items-start gap-2 text-sm senior:text-base ${alreadyQuick ? "opacity-70" : ""}`}>
          <input
            type="checkbox"
            checked={addToQuickLog && !alreadyQuick}
            disabled={alreadyQuick}
            onChange={(e) => setAddToQuickLog(e.target.checked)}
            className="w-4 h-4 mt-0.5 accent-[var(--w360-accent)]"
          />
          <span>
            Also add this to my quick log
            {alreadyQuick && <span className="block text-xs text-[var(--w360-text-muted)]">It's already in your quick log.</span>}
          </span>
        </label>
      )}
      <Button type="submit" disabled={!complete}>{submitLabel}</Button>
    </form>
  );
}

/** A small inline form to add one of her own shortcuts. An identical one can't be added twice. */
function QuickLogAdder({
  catalog,
  weightKg,
  quickKeys,
  onAdd,
}: {
  catalog: ActivityCatalog;
  weightKg: number | null;
  quickKeys: Set<string>;
  onAdd: (v: { activityCode: string; duration: number; intensity: Effort }) => Promise<boolean>;
}) {
  const [fields, setFields] = useState<FieldsValue>(emptyFields());
  const complete = fields.code !== "" && fields.effort !== "" && !!fields.minutes;
  const duplicate = complete && quickKeys.has(shortcutKey(fields.code, fields.minutes!, fields.effort as Effort));

  return (
    <form
      className="flex flex-col gap-4 rounded-2xl border border-[var(--w360-border)] bg-[var(--w360-bg-warm)] p-4 max-w-lg"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!complete || duplicate) return;
        if (await onAdd({ activityCode: fields.code, duration: fields.minutes!, intensity: fields.effort as Effort })) setFields(emptyFields());
      }}
    >
      <p className="text-sm font-medium">New shortcut</p>
      <ActivityFields catalog={catalog} weightKg={weightKg} value={fields} onChange={setFields} withExtras={false} idPrefix="quick" />
      {duplicate && <p className="text-sm text-[var(--w360-warning-text)]" role="alert">That's already in your quick log.</p>}
      <div>
        <Button type="submit" size="sm" disabled={!complete || duplicate}>Add to quick log</Button>
      </div>
    </form>
  );
}

export default function ActivityPage() {
  const [data, setData] = useState<ActivitySummary | null>(null);
  const [catalog, setCatalog] = useState<ActivityCatalog | null>(null);
  const [failed, setFailed] = useState(false);
  const [cycle, setCycle] = useState<CycleSummary | null>(null);
  const [quick, setQuick] = useState<QuickLogItem[] | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [customising, setCustomising] = useState(false);
  const [busyChip, setBusyChip] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [prefill, setPrefill] = useState<FieldsValue | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<ActivityEntry | null>(null);
  const [detail, setDetail] = useState<ActivityEntry | null>(null);
  const [editing, setEditing] = useState(false);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);
  const [stepsEditing, setStepsEditing] = useState(false);
  const [stepsValue, setStepsValue] = useState("");
  const toast = useToast();

  const reload = () => activityService.getSummary().then(setData);
  const load = () => {
    setFailed(false);
    Promise.all([reload(), activityService.catalog().then(setCatalog)]).catch(() => setFailed(true));
    cycleService.getSummary().then(setCycle).catch(() => undefined);
    activityService.listQuickLog().then(setQuick).catch(() => setQuick([]));
    habitService.list().then(setHabits).catch(() => setHabits([]));
  };
  useEffect(load, []);

  const quickKeys = useMemo(() => new Set((quick ?? []).map((q) => shortcutKey(q.activityCode, q.duration, q.intensity))), [quick]);
  const effortName = (code: string, effort: Effort) =>
    catalog?.activities.find((a) => a.code === code)?.levels.find((l) => effortOf(l.key) === effort)?.short ?? effort;
  const effortLabel = (code: string, effort: Effort) =>
    catalog?.activities.find((a) => a.code === code)?.levels.find((l) => effortOf(l.key) === effort)?.label ?? effort;

  if (failed) return <ErrorState title="Couldn't load your activity" onRetry={load} />;
  if (!data || !catalog) return <LoadingState label="Loading activity" />;

  const fail = (err: unknown, fallback: string) => toast.show(err instanceof Error ? err.message : fallback, { tone: "error" });
  const today = localDateISO();
  const caloriesToday = data.weightKg === null ? null : data.entries.filter((e) => e.day === today).reduce((sum, e) => sum + (e.caloriesBurned ?? 0), 0);

  function openAdd(template?: FieldsValue) {
    setPrefill(template ?? null);
    setFormKey((k) => k + 1);
    setAddOpen(true);
  }

  // One tap on a quick-log chip is the whole action: it logs today, no form.
  async function logQuick(item: QuickLogItem) {
    if (busyChip) return;
    setBusyChip(item.id);
    try {
      await activityService.logActivity({ activityCode: item.activityCode, duration: item.duration, intensity: item.intensity });
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

  async function addQuick(v: { activityCode: string; duration: number; intensity: Effort }) {
    try {
      const created = await activityService.addQuickLog(v);
      setQuick((q) => (q ? [...q, created] : [created]));
      return true;
    } catch (err) {
      fail(err, "Could not add that to your quick log.");
      return false;
    }
  }

  async function handleAdd(v: FormValues) {
    try {
      await activityService.logActivity({ activityCode: v.activityCode, duration: v.minutes, intensity: v.effort, distanceKm: v.distanceKm, sets: v.sets });
      if (v.addToQuickLog) await addQuick({ activityCode: v.activityCode, duration: v.minutes, intensity: v.effort });
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
      await activityService.updateEntry(detail.id, {
        activityCode: v.activityCode,
        duration: v.minutes,
        intensity: v.effort,
        distanceKm: v.distanceKm,
        sets: v.sets,
        notes: v.notes,
        day: v.day,
      });
      await reload();
      setDetail(null);
      setEditing(false);
      toast.show("Activity updated");
    } catch (err) {
      fail(err, "Could not save that. Please try again.");
    }
  }

  async function saveSteps() {
    const n = Number(stepsValue);
    if (stepsValue === "" || !Number.isInteger(n) || n < 0 || n > 200_000) {
      toast.show("Enter a whole number of steps, up to 200,000.", { tone: "error" });
      return;
    }
    try {
      await activityService.logSteps(n);
      await reload();
      setStepsEditing(false);
      toast.show("Steps updated");
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

  const gentle = quick?.find((q) => q.intensity === "low");

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
          <ActivityForm
            key={formKey}
            catalog={catalog}
            weightKg={data.weightKg}
            prefill={prefill}
            quickKeys={quickKeys}
            submitLabel="Save activity"
            onSubmit={handleAdd}
            offerQuickLog
          />
        </LogPopover>
      </div>

      <ActivityHabits habits={habits} onChange={(h) => setHabits((list) => list.map((x) => (x.id === h.id ? h : x)))} />

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
                {busyChip !== t.id && t.caloriesBurned !== null && <span className="text-[var(--w360-text-muted)]"> · {t.caloriesBurned} kcal</span>}
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
          {quick && quick.length === 0 && !customising && <span className="text-xs text-[var(--w360-text-muted)]">Nothing here yet.</span>}
          <button
            type="button"
            onClick={() => setCustomising((c) => !c)}
            aria-pressed={customising}
            className="text-xs px-2.5 py-1.5 rounded-full text-[var(--w360-accent)] hover:underline inline-flex items-center gap-1 senior:text-sm"
          >
            {customising ? "Done" : (<><Pencil size={12} /> Edit</>)}
          </button>
        </div>
        {customising && <QuickLogAdder catalog={catalog} weightKg={data.weightKg} quickKeys={quickKeys} onAdd={addQuick} />}
      </section>

      {cycle?.phase === "menstrual" && !suggestionDismissed && (
        <Card>
          <CardBody className="pt-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium senior:text-base">Lower-intensity days can feel better right now</p>
              <p className="text-xs text-[var(--w360-text-muted)] mt-0.5">
                Just a suggestion based on your cycle: a walk, stretch or yoga session, or skip it entirely.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {gentle && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => openAdd({ code: gentle.activityCode, effort: gentle.intensity, minutes: gentle.duration, distance: "", sets: "" })}
                >
                  Log something gentle
                </Button>
              )}
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

      <div className="grid lg:grid-cols-3 sm:grid-cols-2 gap-4">
        <Card>
          <CardBody className="flex items-center gap-5 pt-5">
            <ProgressRing value={(data.steps / data.stepsGoal) * 100} size={80} label={`${Math.round((data.steps / data.stepsGoal) * 100)}%`} />
            <div>
              <p className="text-sm text-[var(--w360-text-muted)]">Steps today</p>
              <p className="text-2xl font-display font-semibold tabular-nums">{data.steps.toLocaleString()}</p>
              <p className="text-xs text-[var(--w360-text-muted)]">Goal: {data.stepsGoal.toLocaleString()}</p>
              {stepsEditing ? (
                <div className="flex items-center gap-1 mt-2">
                  <div className="w-40">
                    <NumberField label="Steps today" max={200000} step={100} startAt={data.steps || 5000} value={stepsValue} onChange={setStepsValue} />
                  </div>
                  <button onClick={saveSteps} aria-label="Save steps" className="p-1 rounded text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"><Check size={14} /></button>
                  <button onClick={() => setStepsEditing(false)} aria-label="Cancel" className="p-1 rounded text-[var(--w360-text-muted)] hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"><X size={14} /></button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setStepsValue(String(data.steps || ""));
                      setStepsEditing(true);
                    }}
                    className="text-xs font-medium text-maroon-700 dark:text-maroon-200 mt-1"
                  >
                    Update steps
                  </button>
                  <p className="text-xs text-[var(--w360-text-muted)] mt-0.5">Entered by hand. Syncing from a watch isn't available yet.</p>
                </>
              )}
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
        <Card>
          <CardBody className="flex items-center gap-5 pt-5">
            <span aria-hidden className="grid place-items-center w-20 h-20 rounded-full bg-[var(--w360-tint)] text-[var(--w360-accent)] shrink-0">
              <Flame size={30} strokeWidth={1.6} />
            </span>
            <div>
              <p className="text-sm text-[var(--w360-text-muted)]">Calories burned today</p>
              <p className="text-2xl font-display font-semibold tabular-nums">{caloriesToday === null ? "-" : `${caloriesToday} kcal`}</p>
              {caloriesToday === null ? (
                <p className="text-xs text-[var(--w360-text-muted)]">
                  <Link to="/app/health" className="underline underline-offset-2">Log your weight</Link> to see an estimate.
                </p>
              ) : (
                <p className="text-xs text-[var(--w360-text-muted)]">An estimate from your {data.weightKg} kg.</p>
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody className="pt-5">
          <p className="text-sm font-medium mb-3">This week</p>
          <div className="h-44" aria-hidden="true">
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
              ariaLabel="Recent activity"
              maxHeight={460}
              items={data.entries.map((e) => ({
                id: e.id,
                entry: e,
                title: e.type,
                description: [e.date, e.distanceKm !== undefined ? `${e.distanceKm} km` : null, e.sets !== undefined ? `${e.sets} sets` : null, e.notes].filter(Boolean).join(" · "),
                meta: [formatDuration(e.duration), e.activityCode === "other" ? null : effortName(e.activityCode, e.intensity), e.caloriesBurned !== null ? `${e.caloriesBurned} kcal` : null]
                  .filter(Boolean)
                  .join(" · "),
              }))}
              onItemSelect={(row) => setDetail(row.entry)}
            />
          </>
        )}
      </section>

      <Modal open={detail !== null} onClose={() => { setDetail(null); setEditing(false); }} title={editing ? "Edit activity" : (detail?.type ?? "Activity")} size="sm">
        {detail && editing && (
          <ActivityForm catalog={catalog} weightKg={data.weightKg} entry={detail} quickKeys={quickKeys} submitLabel="Save changes" onSubmit={handleEdit} />
        )}
        {detail && !editing && (
          <div className="flex flex-col gap-4">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-[var(--w360-text-muted)]">When</dt>
              <dd>{detail.date}</dd>
              <dt className="text-[var(--w360-text-muted)]">Duration</dt>
              <dd className="tabular-nums">{formatDuration(detail.duration)}</dd>
              {detail.activityCode !== "other" && (
                <>
                  <dt className="text-[var(--w360-text-muted)]">Effort</dt>
                  <dd>{effortLabel(detail.activityCode, detail.intensity)}</dd>
                </>
              )}
              {detail.distanceKm !== undefined && (
                <>
                  <dt className="text-[var(--w360-text-muted)]">Distance</dt>
                  <dd className="tabular-nums">{detail.distanceKm} km</dd>
                </>
              )}
              {detail.sets !== undefined && (
                <>
                  <dt className="text-[var(--w360-text-muted)]">Sets</dt>
                  <dd className="tabular-nums">{detail.sets}</dd>
                </>
              )}
              <dt className="text-[var(--w360-text-muted)]">Calories</dt>
              <dd className="tabular-nums">{detail.caloriesBurned !== null ? `About ${detail.caloriesBurned} kcal` : detail.activityCode === "other" ? "Not estimated (older entry; edit it to pick an activity)" : "Log your weight to see this"}</dd>
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

      <p className="text-xs text-[var(--w360-text-muted)]">
        Calorie figures are estimates from your logged weight and standard values for each activity (2011 Compendium of Physical Activities). They are a guide, not a measurement.
      </p>
    </div>
  );
}
