import { useEffect, useState, type FormEvent } from "react";
import { Pencil, Plus, Check, X } from "lucide-react";
import clsx from "clsx";
import { habitService, type HabitInput } from "@/services/habitService";
import { localDateISO, to12Hour, to24Hour } from "@/services/mappers";
import { quickStep } from "@/lib/quickStep";
import type { Habit } from "@/types";
import { Card, CardBody } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { LogPopover } from "@/components/ui/LogPopover";
import { NumberField } from "@/components/ui/NumberField";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LoadingState, EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/Toast";
import PulseHeart from "@/components/reactbits/PulseHeart";
import BellToggle from "@/components/reactbits/BellToggle";
import { DEFAULT_REMINDER, REMINDER_TIME_OPTIONS, STRICT_12H_TIME } from "@/lib/reminderTimes";

// One tap to add something common. These create the habit straight away; it
// can be adjusted afterwards with the pencil.
const IDEAS: HabitInput[] = [
  { title: "Walk 10,000 steps", target: 10000, unit: "steps" },
  { title: "Drink 8 glasses of water", target: 8, unit: "glasses" },
  { title: "Move for 30 minutes", target: 30, unit: "min" },
  { title: "Stretch", target: 10, unit: "min" },
  { title: "Take my vitamin" },
  { title: "Meditate", target: 5, unit: "min" },
  { title: "Strength session", daysPerWeek: 3 },
  { title: "Wind down before bed" },
];

const UNIT_SUGGESTIONS = ["steps", "glasses", "min", "pages", "km", "litres", "reps"];

interface HabitForm {
  title: string;
  tracking: "tick" | "count";
  target: string;
  unit: string;
  frequency: "daily" | "some";
  days: string;
  reminder: string; // 24h "HH:MM", or "" for none
}

const emptyForm = (): HabitForm => ({ title: "", tracking: "tick", target: "", unit: "", frequency: "daily", days: "", reminder: "" });

const formFrom = (h: Habit): HabitForm => ({
  title: h.title,
  tracking: h.target ? "count" : "tick",
  target: h.target ? String(h.target) : "",
  unit: h.unit ?? "",
  frequency: h.daysPerWeek >= 7 ? "daily" : "some",
  days: h.daysPerWeek >= 7 ? "" : String(h.daysPerWeek),
  reminder: h.reminder && STRICT_12H_TIME.test(h.reminder.trim()) ? to24Hour(h.reminder) : "",
});

const num = (n: number) => Number(n.toFixed(2)).toLocaleString();

function cadence(h: Habit): string {
  return h.daysPerWeek >= 7 ? "Every day" : `${h.daysPerWeek} days a week · ${h.thisWeek} of ${h.daysPerWeek} this week`;
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium mb-1.5">{label}</legend>
      <div className="grid grid-cols-2 gap-2" role="radiogroup">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={clsx(
              "rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors",
              value === o.value ? "border-maroon-700 bg-[var(--w360-tint)] dark:border-maroon-300" : "border-[var(--w360-border)] hover:border-maroon-400"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export default function HabitsPage() {
  const [habits, setHabits] = useState<Habit[] | null>(null);
  const [editing, setEditing] = useState<Habit | "new" | null>(null);
  const [form, setForm] = useState<HabitForm>(emptyForm());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Habit | null>(null);
  const [quickId, setQuickId] = useState<string | null>(null);
  const [quickValue, setQuickValue] = useState("");
  // Bumped when a tap fails, to remount the hearts so a count they already
  // animated up snaps back to what the server holds.
  const [heartEpoch, setHeartEpoch] = useState(0);
  const toast = useToast();

  useEffect(() => {
    habitService.list().then(setHabits);
  }, []);

  if (!habits) return <LoadingState label="Loading habits" />;

  const isNew = editing === "new";
  const set = (patch: Partial<HabitForm>) => setForm((f) => ({ ...f, ...patch }));
  const replace = (h: Habit) => setHabits((list) => (list ? list.map((x) => (x.id === h.id ? h : x)) : list));
  const fail = (err: unknown, fallback: string) =>
    toast.show(err instanceof Error ? err.message : fallback, { tone: "error" });

  function openAdd() {
    setForm(emptyForm());
    setErrors({});
    setEditing("new");
  }

  function openEdit(h: Habit) {
    setForm(formFrom(h));
    setErrors({});
    setEditing(h);
  }

  async function quickAdd(idea: HabitInput) {
    try {
      const created = await habitService.create(idea);
      setHabits((list) => (list ? [...list, created] : [created]));
      setEditing(null);
      toast.show(`Added "${created.title}"`);
    } catch (err) {
      fail(err, "Couldn't add that habit. Please try again.");
    }
  }

  async function tap(h: Habit, done: boolean) {
    try {
      replace(await (done ? habitService.log(h.id) : habitService.unlog(h.id)));
    } catch (err) {
      setHeartEpoch((n) => n + 1);
      fail(err, "Couldn't save that. Please try again.");
    }
  }

  // One tap adds a sensible chunk toward today's target (the exact amount can still be typed).
  async function addAmount(h: Habit, step: number) {
    try {
      replace(await habitService.log(h.id, (h.amountToday ?? 0) + step));
    } catch (err) {
      fail(err, "Couldn't save that. Please try again.");
    }
  }

  // Forgot to tick yesterday? Tap its dot. Today's is the heart.
  async function toggleDay(h: Habit, daysAgo: number, done: boolean) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    try {
      replace(await habitService.logOn(h.id, localDateISO(d), !done));
    } catch (err) {
      fail(err, "Couldn't save that. Please try again.");
    }
  }

  async function saveAmount(h: Habit) {
    const value = Number(quickValue);
    if (quickValue === "" || Number.isNaN(value) || value < 0) {
      toast.show("Enter a valid, non-negative number.", { tone: "error" });
      return;
    }
    try {
      replace(await habitService.log(h.id, value));
      setQuickId(null);
    } catch (err) {
      fail(err, "Couldn't save that. Please try again.");
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.title.trim()) errs.title = "Give it a name.";
    if (form.tracking === "count" && !(Number(form.target) > 0)) errs.target = "Enter a daily target.";
    if (form.frequency === "some" && !(Number(form.days) >= 1 && Number(form.days) <= 6)) errs.days = "Choose 1 to 6 days.";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const input: HabitInput = {
      title: form.title.trim(),
      target: form.tracking === "count" ? Number(form.target) : null,
      unit: form.tracking === "count" ? form.unit.trim() || null : null,
      daysPerWeek: form.frequency === "daily" ? 7 : Number(form.days),
      reminder: form.reminder ? to12Hour(form.reminder) : null,
    };
    setSaving(true);
    try {
      if (isNew) {
        const created = await habitService.create(input);
        setHabits((list) => (list ? [...list, created] : [created]));
        toast.show("Habit added");
      } else if (editing) {
        replace(await habitService.update(editing.id, input));
        toast.show("Habit updated");
      }
      setEditing(null);
    } catch (err) {
      fail(err, "Couldn't save that habit. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    try {
      await habitService.remove(id);
      setHabits((list) => (list ? list.filter((x) => x.id !== id) : list));
      toast.show("Habit deleted");
    } catch (err) {
      fail(err, "Couldn't delete that habit. Please try again.");
    } finally {
      setDeleteTarget(null);
    }
  }

  const ideasRow = (
    <div className="flex flex-wrap gap-2">
      {IDEAS.map((idea) => (
        <button
          key={idea.title}
          type="button"
          onClick={() => quickAdd(idea)}
          disabled={habits.some((h) => h.title === idea.title)}
          className="text-xs px-3 py-1.5 rounded-full border border-[var(--w360-border)] hover:border-maroon-400 hover:text-maroon-700 dark:hover:text-maroon-300 transition-colors disabled:opacity-40 disabled:cursor-default"
        >
          + {idea.title}
        </button>
      ))}
    </div>
  );

  // One form for "new" (popover) and "edit" (modal): a name, how it's tracked,
  // how often, and an optional reminder.
  const habitForm = (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      {isNew && (
        <div>
          <p className="text-xs text-[var(--w360-text-muted)] mb-2">Tap one to add it right now</p>
          {ideasRow}
          <p className="text-xs text-[var(--w360-text-muted)] mt-4">…or make your own</p>
        </div>
      )}

      <Input label="Habit" placeholder="e.g. Walk 10,000 steps" value={form.title} onChange={(e) => set({ title: e.target.value })} error={errors.title} required />

      <Segmented
        label="How do you track it?"
        value={form.tracking}
        options={[
          { value: "tick", label: "Tick it off" },
          { value: "count", label: "Count something" },
        ]}
        onChange={(tracking) => set({ tracking })}
      />
      {form.tracking === "count" && (
        <div className="grid grid-cols-2 gap-3 items-start">
          <NumberField label="Daily target" max={100000} step={1} startAt={10} value={form.target} onChange={(v) => set({ target: v })} error={errors.target} />
          <Input aria-label="Unit" placeholder="Unit, e.g. steps" list="habit-units" value={form.unit} onChange={(e) => set({ unit: e.target.value })} />
          <datalist id="habit-units">
            {UNIT_SUGGESTIONS.map((u) => <option key={u} value={u} />)}
          </datalist>
        </div>
      )}

      <Segmented
        label="How often?"
        value={form.frequency}
        options={[
          { value: "daily", label: "Every day" },
          { value: "some", label: "Some days" },
        ]}
        onChange={(frequency) => set({ frequency })}
      />
      {form.frequency === "some" && (
        <NumberField label="Days a week" suffix="days" min={1} max={6} step={1} startAt={3} value={form.days} onChange={(v) => set({ days: v })} error={errors.days} />
      )}

      <div className="flex flex-col gap-2">
        <BellToggle
          size="sm"
          offLabel="Remind me"
          onLabel="Reminder on"
          label="Daily reminder"
          badge={false}
          pressed={form.reminder !== ""}
          onChange={(on) => set({ reminder: on ? DEFAULT_REMINDER : "" })}
          color="var(--w360-text)"
          background="var(--w360-bg-warm)"
          onColor="var(--w360-bg-raised)"
          onBackground="var(--w360-accent)"
        />
        {form.reminder !== "" && (
          <>
            <label htmlFor="habit-reminder" className="text-sm font-medium">Reminder time</label>
            <select
              id="habit-reminder"
              value={form.reminder}
              onChange={(e) => set({ reminder: e.target.value })}
              className="px-3.5 py-2.5 rounded border border-[var(--w360-border)] bg-[var(--w360-bg-raised)] text-[var(--w360-text)] text-sm"
            >
              {REMINDER_TIME_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <p className="text-xs text-[var(--w360-text-muted)]">Shown in your Today list when you open Women360 — not a push notification.</p>
          </>
        )}
      </div>

      <Button type="submit" disabled={saving}>{saving ? "Saving…" : isNew ? "Add habit" : "Save changes"}</Button>
      {!isNew && editing && (
        <Button
          type="button"
          variant="danger"
          onClick={() => {
            setDeleteTarget(editing);
            setEditing(null);
          }}
        >
          Delete this habit
        </Button>
      )}
    </form>
  );

  const doneCount = habits.filter((h) => h.doneToday).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Habits</h1>
          <p className="text-[var(--w360-text-muted)] mt-1">
            {habits.length === 0 ? "Small things you do again and again." : `${doneCount} of ${habits.length} done today`}
          </p>
        </div>
        <LogPopover
          open={isNew}
          onOpenChange={(o) => (o ? openAdd() : setEditing(null))}
          triggerLabel="New habit"
          triggerIcon={<Plus size={16} />}
          title="New habit"
        >
          {habitForm}
        </LogPopover>
      </div>

      {habits.length === 0 ? (
        <Card>
          <CardBody className="pt-5 flex flex-col gap-4">
            <EmptyState
              title="No habits yet"
              description="A habit is something you do every day, or a few days a week. Add one in a single tap."
            />
            {ideasRow}
          </CardBody>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {[...habits.filter((h) => !h.doneToday), ...habits.filter((h) => h.doneToday)].map((h) => {
            const amountPct = h.target ? Math.min(100, Math.round(((h.amountToday ?? 0) / h.target) * 100)) : 0;
            const unit = h.unit ? ` ${h.unit}` : "";
            const editingAmount = quickId === h.id;
            return (
              <Card key={h.id}>
                <CardBody className="pt-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">{h.title}</p>
                      <p className="text-xs text-[var(--w360-text-muted)] mt-0.5">
                        {cadence(h)}
                        {h.reminder ? ` · ${h.reminder}` : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => openEdit(h)}
                      aria-label={`Edit "${h.title}"`}
                      className="p-1 rounded hover:bg-black/[0.05] dark:hover:bg-white/[0.08] text-[var(--w360-text-muted)] shrink-0"
                    >
                      <Pencil size={16} />
                    </button>
                  </div>

                  {h.target ? (
                    <div className="mt-3">
                      <ProgressBar value={amountPct} />
                      <div className="flex items-center justify-between mt-2 gap-2">
                        <p className="text-xs text-[var(--w360-text-muted)] tabular-nums">
                          {num(h.amountToday ?? 0)} / {num(h.target)}
                          {unit} today
                        </p>
                        {editingAmount ? (
                          <div className="flex items-center gap-1 shrink-0">
                            <div className="w-36">
                              <NumberField label="Today" suffix={h.unit} max={Math.max(h.target * 3, 100)} step={1} value={quickValue} onChange={setQuickValue} />
                            </div>
                            <button onClick={() => saveAmount(h)} aria-label="Save amount" className="p-1 rounded text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40">
                              <Check size={14} />
                            </button>
                            <button onClick={() => setQuickId(null)} aria-label="Cancel" className="p-1 rounded text-[var(--w360-text-muted)] hover:bg-black/[0.05] dark:hover:bg-white/[0.08]">
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 shrink-0">
                            {!h.doneToday && (
                              <button
                                onClick={() => addAmount(h, quickStep(h.target!))}
                                aria-label={`Add ${num(quickStep(h.target!))}${unit} to "${h.title}"`}
                                className="inline-flex items-center gap-0.5 text-xs font-medium px-2 py-1 rounded border border-[var(--w360-border)] hover:border-maroon-400 hover:text-maroon-700 dark:hover:text-maroon-200"
                              >
                                <Plus size={12} /> {num(quickStep(h.target!))}
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setQuickId(h.id);
                                setQuickValue(String(h.amountToday ?? 0));
                              }}
                              className="text-xs font-medium text-maroon-700 dark:text-maroon-200"
                            >
                              Log an amount
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}

                  <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-[var(--w360-border)]">
                    <div className="min-w-0">
                      <div className="flex items-center -ml-1.5" role="group" aria-label="The last 7 days. Tap an earlier day to fix it.">
                        {h.last7.map((done, i) => {
                          const daysAgo = 6 - i;
                          const dot = (
                            <span className={clsx("block w-2.5 h-2.5 rounded-full", done ? "bg-maroon-700 dark:bg-maroon-300" : "bg-warmgrey-200 dark:bg-white/15")} />
                          );
                          if (daysAgo === 0) {
                            return (
                              <span key={i} role="img" aria-label={`Today: ${done ? "done" : "not done yet"}`} className="p-1.5">
                                {dot}
                              </span>
                            );
                          }
                          const day = new Date();
                          day.setDate(day.getDate() - daysAgo);
                          const name = day.toLocaleDateString(undefined, { weekday: "long" });
                          return (
                            <button
                              key={i}
                              type="button"
                              onClick={() => toggleDay(h, daysAgo, done)}
                              aria-label={`${name}: ${done ? "done" : "not done"}. Tap to change.`}
                              title={`${name}: ${done ? "done" : "not done"}`}
                              className="p-1.5 rounded-full hover:bg-black/[0.06] dark:hover:bg-white/[0.1]"
                            >
                              {dot}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-xs text-[var(--w360-text-muted)] mt-1.5">
                        {h.doneToday ? "Done for today" : "Tap when you've done it"}
                        {h.streak > 1 ? ` · ${h.streak} ${h.streakUnit}s in a row` : ""}
                      </p>
                    </div>
                    <PulseHeart
                      key={`${h.id}-${heartEpoch}`}
                      icon="fire"
                      size={26}
                      liked={h.doneToday}
                      count={h.streak}
                      onChange={(liked) => tap(h, liked)}
                      label={`${h.title}, ${h.streakUnit} streak`}
                      likedColor="var(--w360-flame)"
                      idleColor="var(--w360-text-muted)"
                      pillColor="var(--w360-tint)"
                      textColor="var(--w360-text)"
                    />
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={editing !== null && editing !== "new"} onClose={() => setEditing(null)} title="Edit habit" size="sm">
        {habitForm}
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete this habit?"
        description={deleteTarget ? `"${deleteTarget.title}" and its history will be removed permanently.` : undefined}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
