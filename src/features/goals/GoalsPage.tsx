import { useEffect, useState, type FormEvent } from "react";
import { goalService } from "@/services/goalService";
import { goalProgress, localDateISO, to12Hour, to24Hour, type GoalInput } from "@/services/mappers";
import type { Goal, GoalKind } from "@/types";
import { Card, CardBody } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { LogPopover } from "@/components/ui/LogPopover";
import { Input } from "@/components/ui/Input";
import { NumberField } from "@/components/ui/NumberField";
import BellToggle from "@/components/reactbits/BellToggle";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LoadingState, EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/Toast";
import { DEFAULT_REMINDER, REMINDER_TIME_OPTIONS, STRICT_12H_TIME } from "@/lib/reminderTimes";
import { CheckCircle2, Circle, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import clsx from "clsx";

// One tap to start from something common. The kind decides which fields appear,
// so each of these arrives with the right ones already filled.
interface GoalIdea {
  label: string;
  kind: GoalKind;
  title: string;
  unit?: string;
  target?: number;
  category: Goal["category"];
}
const IDEAS: GoalIdea[] = [
  { label: "Lose weight", kind: "reach", title: "Lose weight", unit: "kg", category: "body" },
  { label: "Read books", kind: "total", title: "Read 12 books", unit: "books", target: 12, category: "learning" },
  { label: "Cover a distance", kind: "total", title: "Walk or run 100 km", unit: "km", target: 100, category: "activity" },
  { label: "Book a check-up", kind: "oneOff", title: "Book my annual health check-up", category: "preventive" },
];

const KINDS: { kind: GoalKind; label: string; hint: string }[] = [
  { kind: "reach", label: "Reach a number", hint: "like a weight" },
  { kind: "total", label: "Build up a total", hint: "like books read" },
  { kind: "oneOff", label: "Do one thing", hint: "like booking a check-up" },
];

const UNIT_SUGGESTIONS = ["kg", "lb", "cm", "books", "km", "sessions", "pages", "litres"];

interface GoalForm {
  title: string;
  kind: GoalKind;
  category: Goal["category"];
  unit: string;
  now: string; // where a "reach" goal is today
  target: string;
  dueDate: string; // YYYY-MM-DD or ""
  reminder: string; // 24h "HH:MM", or "" for none
}

function emptyForm(): GoalForm {
  return { title: "", kind: "total", category: "other", unit: "", now: "", target: "", dueDate: "", reminder: "" };
}

function goalToForm(g: Goal): GoalForm {
  return {
    title: g.title,
    kind: g.kind,
    category: g.category,
    unit: g.unit,
    now: g.kind === "reach" ? String(g.currentValue) : "",
    target: g.kind === "oneOff" ? "" : String(g.targetValue),
    dueDate: g.dueDate ?? "",
    reminder: g.reminder && STRICT_12H_TIME.test(g.reminder.trim()) ? to24Hour(g.reminder) : "",
  };
}

const num = (n: number) => Number(n.toFixed(2)).toLocaleString();

function dueText(goal: Goal): string | null {
  if (!goal.dueDate) return null;
  const days = Math.round((Date.parse(`${goal.dueDate}T00:00:00Z`) - Date.parse(`${localDateISO()}T00:00:00Z`)) / 86_400_000);
  const date = new Date(`${goal.dueDate}T00:00:00Z`).toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "UTC" });
  if (goal.completed) return `Aimed for ${date}`;
  if (days > 1) return `Due ${date} · ${days} days left`;
  if (days === 1) return `Due ${date} · tomorrow`;
  if (days === 0) return `Due today`;
  return `Was due ${date}`;
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[] | null>(null);
  const [editingGoal, setEditingGoal] = useState<Goal | "new" | null>(null);
  const [form, setForm] = useState<GoalForm>(emptyForm());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Goal | null>(null);
  const [quickEditId, setQuickEditId] = useState<string | null>(null);
  const [quickValue, setQuickValue] = useState("");
  const toast = useToast();

  useEffect(() => {
    goalService.list().then(setGoals);
  }, []);

  if (!goals) return <LoadingState label="Loading goals" />;

  const isNew = editingGoal === "new";
  const set = (patch: Partial<GoalForm>) => setForm((f) => ({ ...f, ...patch }));

  function openAdd() {
    setForm(emptyForm());
    setErrors({});
    setEditingGoal("new");
  }

  function openEdit(goal: Goal) {
    setForm(goalToForm(goal));
    setErrors({});
    setEditingGoal(goal);
  }

  function applyIdea(idea: GoalIdea) {
    set({
      kind: idea.kind,
      title: idea.title,
      category: idea.category,
      unit: idea.unit ?? "",
      target: idea.target !== undefined ? String(idea.target) : "",
      now: "",
    });
    setErrors({});
  }

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!form.title.trim()) errs.title = "Enter a goal.";
    const target = Number(form.target);
    const now = Number(form.now);
    if (form.kind === "total" && (form.target === "" || !(target > 0))) errs.target = "Enter a target greater than 0.";
    if (form.kind === "reach") {
      if (form.now === "") errs.now = "Enter where you are now.";
      if (form.target === "") errs.target = "Enter your target.";
      else if (form.now !== "" && target === now) errs.target = "Your target should be different from where you are now.";
    }
    return errs;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const reminder = form.reminder ? to12Hour(form.reminder) : undefined;
    setSaving(true);
    try {
      if (isNew) {
        const input: GoalInput = {
          title: form.title.trim(),
          kind: form.kind,
          category: form.category,
          unit: form.unit.trim() || undefined,
          dueDate: form.dueDate || undefined,
          reminder,
          ...(form.kind === "total" ? { targetValue: Number(form.target) } : {}),
          ...(form.kind === "reach" ? { currentValue: Number(form.now), targetValue: Number(form.target) } : {}),
        };
        const created = await goalService.create(input);
        setGoals((g) => (g ? [created, ...g] : [created]));
        toast.show("Goal created");
      } else if (editingGoal) {
        const updated = await goalService.update(editingGoal.id, {
          title: form.title.trim(),
          unit: form.unit.trim(),
          dueDate: form.dueDate || null,
          // An empty string clears the reminder; leaving it out would keep the old one.
          reminder: reminder ?? "",
          ...(form.kind !== "oneOff" ? { targetValue: Number(form.target) } : {}),
          ...(form.kind === "reach" ? { currentValue: Number(form.now) } : {}),
        });
        setGoals((g) => (g ? g.map((x) => (x.id === updated.id ? updated : x)) : g));
        toast.show("Goal updated");
      }
      setEditingGoal(null);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't save that goal. Please try again.", { tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function patch(goal: Goal, change: Parameters<typeof goalService.update>[1], message?: string) {
    try {
      const updated = await goalService.update(goal.id, change);
      setGoals((g) => (g ? g.map((x) => (x.id === updated.id ? updated : x)) : g));
      if (message) toast.show(message);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't update that goal. Please try again.", { tone: "error" });
    }
  }

  async function saveQuick(goal: Goal) {
    const value = Number(quickValue);
    if (quickValue === "" || Number.isNaN(value) || value < 0) {
      toast.show("Enter a valid, non-negative number.", { tone: "error" });
      return;
    }
    await patch(goal, { currentValue: value }, "Progress updated");
    setQuickEditId(null);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    try {
      await goalService.remove(id);
      setGoals((g) => (g ? g.filter((x) => x.id !== id) : g));
      toast.show("Goal deleted");
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't delete that goal. Please try again.", { tone: "error" });
    } finally {
      setDeleteTarget(null);
    }
  }

  const active = goals.filter((g) => !g.completed);
  const completed = goals.filter((g) => g.completed);

  function renderGoal(g: Goal) {
    const progress = goalProgress(g);
    const due = dueText(g);
    const unit = g.unit ? ` ${g.unit}` : "";
    const editing = quickEditId === g.id;

    return (
      <Card key={g.id}>
        <CardBody className="pt-5">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium">{g.title}</p>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => patch(g, { completed: !g.completed }, g.completed ? "Goal marked active" : "Goal marked complete")}
                aria-label={g.completed ? `Mark "${g.title}" as active` : `Mark "${g.title}" as complete`}
                aria-pressed={g.completed}
                className="p-1 rounded hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
              >
                {g.completed ? <CheckCircle2 size={18} className="text-emerald-600" /> : <Circle size={18} className="text-[var(--w360-text-muted)]" />}
              </button>
              <button
                onClick={() => openEdit(g)}
                aria-label={`Edit "${g.title}"`}
                className="p-1 rounded hover:bg-black/[0.05] dark:hover:bg-white/[0.08] text-[var(--w360-text-muted)]"
              >
                <Pencil size={16} />
              </button>
              <button
                onClick={() => setDeleteTarget(g)}
                aria-label={`Delete "${g.title}"`}
                className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/40 text-[var(--w360-text-muted)] hover:text-red-600"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
          {(g.category !== "other" || due) && (
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {g.category !== "other" && <Badge tone="neutral" className="capitalize">{g.category}</Badge>}
              {due && <span className="text-xs text-[var(--w360-text-muted)]">{due}</span>}
            </div>
          )}

          {g.kind === "oneOff" ? (
            !g.completed && (
              <Button size="sm" className="mt-4" onClick={() => patch(g, { completed: true }, "Marked done")}>
                <Check size={14} /> Mark as done
              </Button>
            )
          ) : (
            <>
              <p className="text-xs text-[var(--w360-text-muted)] mt-3 mb-1.5 tabular-nums">
                {g.kind === "reach"
                  ? `${num(g.startValue ?? g.currentValue)}${unit} → ${num(g.targetValue)}${unit}`
                  : `Target: ${num(g.targetValue)}${unit}`}
              </p>
              <ProgressBar value={progress} />
              <div className="flex items-center justify-between mt-2 gap-2">
                <p className="text-xs text-[var(--w360-text-muted)] tabular-nums">
                  {g.kind === "reach"
                    ? `Now ${num(g.currentValue)}${unit} · ${progress}%`
                    : `${num(g.currentValue)} / ${num(g.targetValue)}${unit} · ${progress}%`}
                  {g.reminder ? ` · ${g.reminder}` : ""}
                </p>
                {editing ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <div className="w-40">
                      <NumberField
                        label={g.kind === "reach" ? "Now" : "Progress"}
                        suffix={g.unit}
                        min={0}
                        max={Math.max(g.targetValue * 3, g.currentValue * 2, 100)}
                        step={g.kind === "reach" ? 0.1 : 1}
                        value={quickValue}
                        onChange={setQuickValue}
                      />
                    </div>
                    <button onClick={() => saveQuick(g)} aria-label="Save progress" className="p-1 rounded text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40">
                      <Check size={14} />
                    </button>
                    <button onClick={() => setQuickEditId(null)} aria-label="Cancel" className="p-1 rounded text-[var(--w360-text-muted)] hover:bg-black/[0.05] dark:hover:bg-white/[0.08]">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 shrink-0">
                    {g.kind === "total" && (
                      <button
                        onClick={() => patch(g, { currentValue: g.currentValue + 1 })}
                        aria-label={`Add 1${unit} to "${g.title}"`}
                        title={`+1${unit}`}
                        className="inline-flex items-center gap-0.5 text-xs font-medium px-2 py-1 rounded border border-[var(--w360-border)] hover:border-maroon-400 hover:text-maroon-700 dark:hover:text-maroon-200"
                      >
                        <Plus size={12} /> 1
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setQuickEditId(g.id);
                        setQuickValue(String(g.currentValue));
                      }}
                      className="text-xs font-medium text-maroon-700 dark:text-maroon-200"
                    >
                      {g.kind === "reach" ? "Update" : "Update progress"}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </CardBody>
      </Card>
    );
  }

  // The same form serves "new" (in the popover) and "edit" (in the modal).
  const goalForm = (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      {isNew && (
        <div>
          <p className="text-xs text-[var(--w360-text-muted)] mb-2">Start from one, or fill it in yourself</p>
          <div className="flex flex-wrap gap-2">
            {IDEAS.map((idea) => (
              <button
                key={idea.label}
                type="button"
                onClick={() => applyIdea(idea)}
                className="text-xs px-3 py-1.5 rounded-full border border-[var(--w360-border)] hover:border-maroon-400 hover:text-maroon-700 dark:hover:text-maroon-300 transition-colors"
              >
                {idea.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {isNew && (
        <fieldset>
          <legend className="text-sm font-medium mb-1.5">What kind of goal?</legend>
          <div className="grid grid-cols-3 gap-2" role="radiogroup">
            {KINDS.map((k) => (
              <button
                key={k.kind}
                type="button"
                role="radio"
                aria-checked={form.kind === k.kind}
                onClick={() => set({ kind: k.kind })}
                className={clsx(
                  "rounded-xl border px-2 py-2.5 text-left transition-colors",
                  form.kind === k.kind
                    ? "border-maroon-700 bg-[var(--w360-tint)] dark:border-maroon-300"
                    : "border-[var(--w360-border)] hover:border-maroon-400"
                )}
              >
                <span className="block text-sm font-medium leading-tight">{k.label}</span>
                <span className="block text-[11px] text-[var(--w360-text-muted)] mt-0.5 leading-tight">{k.hint}</span>
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <Input
        label="Goal"
        placeholder={form.kind === "reach" ? "e.g. Lose weight" : form.kind === "oneOff" ? "e.g. Book a health check-up" : "e.g. Read 12 books"}
        value={form.title}
        onChange={(e) => set({ title: e.target.value })}
        error={errors.title}
        required
      />

      {form.kind !== "oneOff" && (
        <Input
          label="Unit (optional)"
          placeholder="e.g. kg, books, km"
          list="goal-units"
          value={form.unit}
          onChange={(e) => set({ unit: e.target.value })}
        />
      )}
      <datalist id="goal-units">
        {UNIT_SUGGESTIONS.map((u) => <option key={u} value={u} />)}
      </datalist>

      {form.kind === "reach" && (
        <NumberField label="Now" suffix={form.unit.trim() || undefined} max={1000} step={0.1} startAt={60} value={form.now} onChange={(v) => set({ now: v })} error={errors.now} />
      )}
      {form.kind !== "oneOff" && (
        <NumberField
          label={form.kind === "reach" ? "Goal" : "Target"}
          suffix={form.unit.trim() || undefined}
          max={100000}
          step={form.kind === "reach" ? 0.1 : 1}
          startAt={form.kind === "reach" && form.now !== "" ? Number(form.now) : 10}
          value={form.target}
          onChange={(v) => set({ target: v })}
          error={errors.target}
        />
      )}

      <Input label="By when (optional)" type="date" value={form.dueDate} onChange={(e) => set({ dueDate: e.target.value })} />

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
            <label htmlFor="goal-reminder" className="text-sm font-medium">Reminder time</label>
            <select
              id="goal-reminder"
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

      <Button type="submit" disabled={saving}>{saving ? "Saving…" : isNew ? "Create goal" : "Save changes"}</Button>
    </form>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Goals</h1>
          <p className="text-[var(--w360-text-muted)] mt-1">Things you're working toward. For routines you repeat, use Habits.</p>
        </div>
        <LogPopover
          open={isNew}
          onOpenChange={(o) => (o ? openAdd() : setEditingGoal(null))}
          triggerLabel="New goal"
          triggerIcon={<Plus size={16} />}
          title="New goal"
        >
          {goalForm}
        </LogPopover>
      </div>

      {goals.length === 0 ? (
        <EmptyState
          title="No goals yet"
          description="A goal has a finish line: reach a weight, read twelve books, book a check-up."
          action={<Button onClick={openAdd}><Plus size={16} /> New goal</Button>}
        />
      ) : (
        <>
          <section>
            <h2 className="font-display text-lg font-semibold mb-3">Active</h2>
            {active.length === 0 ? (
              <EmptyState title="No active goals" description="Every goal is complete, or you haven't set one yet." />
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">{active.map(renderGoal)}</div>
            )}
          </section>
          {completed.length > 0 && (
            <section>
              <h2 className="font-display text-lg font-semibold mb-3">Completed</h2>
              <div className="grid sm:grid-cols-2 gap-4">{completed.map(renderGoal)}</div>
            </section>
          )}
        </>
      )}

      <Modal open={editingGoal !== null && editingGoal !== "new"} onClose={() => setEditingGoal(null)} title="Edit goal" size="sm">
        {goalForm}
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete this goal?"
        description={deleteTarget ? `"${deleteTarget.title}" will be removed permanently.` : undefined}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
