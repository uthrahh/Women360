import { useEffect, useState, type FormEvent } from "react";
import { goalService } from "@/services/goalService";
import { goalProgress, to12Hour, to24Hour } from "@/services/mappers";
import type { Goal } from "@/types";
import { Card, CardBody } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { LogPopover } from "@/components/ui/LogPopover";
import { Input } from "@/components/ui/Input";
import { NumberField } from "@/components/ui/NumberField";
import PulseHeart from "@/components/reactbits/PulseHeart";
import BellToggle from "@/components/reactbits/BellToggle";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LoadingState, EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/Toast";
import { CheckCircle2, Circle, Plus, Pencil, Trash2, Check, X } from "lucide-react";

const DEFAULT_REMINDER = "09:00";

const CATEGORIES: Goal["category"][] = ["sleep", "activity", "hydration", "nutrition", "strength", "cycle", "mobility"];

// Every 15 minutes across the day, stored/selected in 24h but labeled in
// 12h for readability — a fixed time slot rather than free text, so a
// reminder is always something the backend (eventually) could actually
// schedule against, not an arbitrary string.
const REMINDER_TIME_OPTIONS: { value: string; label: string }[] = Array.from({ length: 24 * 4 }, (_, i) => {
  const hh = String(Math.floor(i / 4)).padStart(2, "0");
  const mm = String((i % 4) * 15).padStart(2, "0");
  const value = `${hh}:${mm}`;
  return { value, label: to12Hour(value) };
});
const STRICT_12H_TIME = /^\d{1,2}:\d{2}\s?(AM|PM)$/i;

interface GoalFormValues {
  title: string;
  category: Goal["category"];
  currentValue: string;
  targetValue: string;
  unit: string;
  reminder: string; // 24h "HH:MM", or "" for no reminder
}

function emptyForm(): GoalFormValues {
  return { title: "", category: "activity", currentValue: "0", targetValue: "", unit: "", reminder: "" };
}

function goalToForm(g: Goal): GoalFormValues {
  return {
    title: g.title,
    category: g.category,
    currentValue: String(g.currentValue),
    targetValue: String(g.targetValue),
    unit: g.unit,
    // Older goals may have a free-text reminder from before this became a
    // strict time picker — only prefill the select when it's actually a
    // clean time, otherwise leave it unset rather than guess.
    reminder: g.reminder && STRICT_12H_TIME.test(g.reminder.trim()) ? to24Hour(g.reminder) : "",
  };
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[] | null>(null);
  const [editingGoal, setEditingGoal] = useState<Goal | "new" | null>(null);
  const [form, setForm] = useState<GoalFormValues>(emptyForm());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Goal | null>(null);
  const [quickEditId, setQuickEditId] = useState<string | null>(null);
  const [quickValue, setQuickValue] = useState("");
  // Bumped when a check-in fails, to remount the hearts so a count they already
  // animated up snaps back to what the server actually holds.
  const [heartEpoch, setHeartEpoch] = useState(0);
  const toast = useToast();

  useEffect(() => {
    goalService.list().then(setGoals);
  }, []);

  if (!goals) return <LoadingState label="Loading goals" />;

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

  function validate(values: GoalFormValues): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!values.title.trim()) errs.title = "Enter a goal.";
    if (!values.unit.trim()) errs.unit = "Enter a unit, e.g. \"steps\" or \"hrs\".";
    const target = Number(values.targetValue);
    if (values.targetValue === "" || Number.isNaN(target) || target <= 0) {
      errs.targetValue = "Enter a target greater than 0.";
    }
    return errs;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const input = {
      title: form.title.trim(),
      category: form.category,
      currentValue: form.currentValue === "" ? 0 : Number(form.currentValue),
      targetValue: Number(form.targetValue),
      unit: form.unit.trim(),
      reminder: form.reminder ? to12Hour(form.reminder) : undefined,
    };

    setSaving(true);
    try {
      if (editingGoal === "new") {
        const created = await goalService.create(input);
        setGoals((g) => (g ? [created, ...g] : [created]));
        toast.show("Goal created");
      } else if (editingGoal) {
        const updated = await goalService.update(editingGoal.id, input);
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

  async function toggleComplete(goal: Goal) {
    try {
      const updated = await goalService.update(goal.id, { completed: !goal.completed });
      setGoals((g) => (g ? g.map((x) => (x.id === updated.id ? updated : x)) : g));
      toast.show(updated.completed ? "Goal marked complete" : "Goal marked active");
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't update that goal. Please try again.", { tone: "error" });
    }
  }

  async function incrementGoal(goal: Goal) {
    try {
      const updated = await goalService.update(goal.id, { currentValue: goal.currentValue + 1 });
      setGoals((g) => (g ? g.map((x) => (x.id === updated.id ? updated : x)) : g));
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't update progress. Please try again.", { tone: "error" });
    }
  }

  async function setCheckIn(goal: Goal, checkedIn: boolean) {
    try {
      const updated = await (checkedIn ? goalService.checkIn(goal.id) : goalService.undoCheckIn(goal.id));
      setGoals((g) => (g ? g.map((x) => (x.id === updated.id ? updated : x)) : g));
    } catch (err) {
      setHeartEpoch((n) => n + 1);
      toast.show(err instanceof Error ? err.message : "Couldn't save your check-in. Please try again.", { tone: "error" });
    }
  }

  async function saveQuickProgress(goal: Goal) {
    const value = Number(quickValue);
    if (Number.isNaN(value) || value < 0) {
      toast.show("Enter a valid, non-negative number.", { tone: "error" });
      return;
    }
    try {
      const updated = await goalService.update(goal.id, { currentValue: value });
      setGoals((g) => (g ? g.map((x) => (x.id === updated.id ? updated : x)) : g));
      toast.show("Progress updated");
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't update progress. Please try again.", { tone: "error" });
    } finally {
      setQuickEditId(null);
    }
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
    return (
      <Card key={g.id}>
        <CardBody className="pt-5">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium">{g.title}</p>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => toggleComplete(g)}
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
          <Badge tone="neutral" className="mt-2 capitalize">{g.category}</Badge>
          <p className="text-xs text-[var(--w360-text-muted)] mt-3 mb-1.5">
            Target: {g.targetValue} {g.unit}
          </p>
          <ProgressBar value={progress} />
          <div className="flex items-center justify-between mt-2 gap-2">
            <p className="text-xs text-[var(--w360-text-muted)]">
              {g.currentValue} / {g.targetValue} {g.unit} · {progress}%{g.reminder ? ` · ${g.reminder}` : ""}
            </p>
            {quickEditId === g.id ? (
              <div className="flex items-center gap-1 shrink-0">
                <div className="w-40">
                  <NumberField
                    label="Progress"
                    suffix={g.unit}
                    min={0}
                    max={Math.max(g.targetValue * 3, 100)}
                    step={1}
                    value={quickValue}
                    onChange={setQuickValue}
                  />
                </div>
                <button onClick={() => saveQuickProgress(g)} aria-label="Save progress" className="p-1 rounded text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40">
                  <Check size={14} />
                </button>
                <button onClick={() => setQuickEditId(null)} aria-label="Cancel" className="p-1 rounded text-[var(--w360-text-muted)] hover:bg-black/[0.05] dark:hover:bg-white/[0.08]">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => incrementGoal(g)}
                  aria-label={`Add 1 ${g.unit} to "${g.title}"`}
                  title={`+1 ${g.unit}`}
                  className="inline-flex items-center gap-0.5 text-xs font-medium px-2 py-1 rounded border border-[var(--w360-border)] hover:border-maroon-400 hover:text-maroon-700 dark:hover:text-maroon-200"
                >
                  <Plus size={12} /> 1
                </button>
                <button
                  onClick={() => {
                    setQuickEditId(g.id);
                    setQuickValue(String(g.currentValue));
                  }}
                  className="text-xs font-medium text-maroon-700 dark:text-maroon-200"
                >
                  Update progress
                </button>
              </div>
            )}
          </div>
          {!g.completed && (
            <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-[var(--w360-border)]">
              <div className="min-w-0">
                <p className="text-xs font-medium">Daily check-in</p>
                <p className="text-xs text-[var(--w360-text-muted)] mt-0.5">
                  {g.checkedInToday ? "Done for today" : "Tap when you've done it today"}
                </p>
              </div>
              <PulseHeart
                key={`${g.id}-${heartEpoch}`}
                icon="fire"
                size={26}
                liked={g.checkedInToday}
                count={g.streak}
                onChange={(liked) => setCheckIn(g, liked)}
                label={`Check in for ${g.title}, day streak`}
                likedColor="var(--w360-flame)"
                idleColor="var(--w360-text-muted)"
                pillColor="var(--w360-tint)"
                textColor="var(--w360-text)"
              />
            </div>
          )}
        </CardBody>
      </Card>
    );
  }

  const goalForm = (
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <Input label="Goal" placeholder="e.g. Walk 8,000 steps daily" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} error={errors.title} required />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="category" className="text-sm font-medium">Category</label>
            <select
              id="category"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as Goal["category"] }))}
              className="px-3.5 py-2.5 rounded border border-[var(--w360-border)] bg-[var(--w360-bg-raised)] text-[var(--w360-text)] text-sm capitalize"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c} className="capitalize">{c}</option>
              ))}
            </select>
          </div>
          <NumberField label="Target" suffix={form.unit.trim() || undefined} min={0} max={100000} step={1} startAt={1} value={form.targetValue} onChange={(v) => setForm((f) => ({ ...f, targetValue: v }))} error={errors.targetValue} />
          <Input label="Unit" placeholder="e.g. steps, hrs, L" value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} error={errors.unit} required />
          <div className="flex flex-col gap-2">
            <BellToggle
              size="sm"
              offLabel="Remind me"
              onLabel="Reminder on"
              label="Daily reminder"
              badge={false}
              pressed={form.reminder !== ""}
              onChange={(on) => setForm((f) => ({ ...f, reminder: on ? DEFAULT_REMINDER : "" }))}
              color="var(--w360-text)"
              background="var(--w360-bg-warm)"
              onColor="var(--w360-bg-raised)"
              onBackground="var(--w360-accent)"
            />
            {form.reminder !== "" && (
              <>
                <label htmlFor="reminder" className="text-sm font-medium">Reminder time</label>
                <select
                  id="reminder"
                  value={form.reminder}
                  onChange={(e) => setForm((f) => ({ ...f, reminder: e.target.value }))}
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
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : editingGoal === "new" ? "Create goal" : "Save changes"}</Button>
        </form>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">Goals</h1>
          <p className="text-[var(--w360-text-muted)] mt-1">Small, trackable commitments you're building on.</p>
        </div>
        <LogPopover
          open={editingGoal === "new"}
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
          description="Set your first goal to start tracking progress over time."
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
