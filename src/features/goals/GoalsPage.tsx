import { useEffect, useState, type FormEvent } from "react";
import { goalService } from "@/services/goalService";
import { goalProgress } from "@/services/mappers";
import type { Goal } from "@/types";
import { Card, CardBody } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LoadingState, EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/Toast";
import { CheckCircle2, Circle, Plus, Pencil, Trash2, Check, X } from "lucide-react";

const CATEGORIES: Goal["category"][] = ["sleep", "activity", "hydration", "nutrition", "strength", "cycle", "mobility"];

interface GoalFormValues {
  title: string;
  category: Goal["category"];
  currentValue: string;
  targetValue: string;
  unit: string;
  reminder: string;
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
    reminder: g.reminder ?? "",
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
    if (!values.title.trim()) errs.title = "Enter a goal title.";
    if (!values.unit.trim()) errs.unit = "Enter a unit, e.g. \"steps\" or \"hrs\".";
    const target = Number(values.targetValue);
    if (values.targetValue === "" || Number.isNaN(target) || target <= 0) {
      errs.targetValue = "Enter a target greater than 0.";
    }
    const current = Number(values.currentValue);
    if (values.currentValue !== "" && (Number.isNaN(current) || current < 0)) {
      errs.currentValue = "Current value can't be negative.";
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
      reminder: form.reminder.trim() || undefined,
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
                <input
                  type="number"
                  min={0}
                  autoFocus
                  value={quickValue}
                  onChange={(e) => setQuickValue(e.target.value)}
                  className="w-16 px-1.5 py-1 rounded border border-[var(--w360-border)] bg-[var(--w360-bg-raised)] text-xs"
                  aria-label={`New progress value for "${g.title}"`}
                />
                <button onClick={() => saveQuickProgress(g)} aria-label="Save progress" className="p-1 rounded text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40">
                  <Check size={14} />
                </button>
                <button onClick={() => setQuickEditId(null)} aria-label="Cancel" className="p-1 rounded text-[var(--w360-text-muted)] hover:bg-black/[0.05] dark:hover:bg-white/[0.08]">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setQuickEditId(g.id);
                  setQuickValue(String(g.currentValue));
                }}
                className="text-xs font-medium text-maroon-700 dark:text-maroon-200 shrink-0"
              >
                Update progress
              </button>
            )}
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">Goals</h1>
          <p className="text-[var(--w360-text-muted)] mt-1">Small, trackable commitments you're building on.</p>
        </div>
        <Button onClick={openAdd}><Plus size={16} /> New goal</Button>
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

      <Modal open={editingGoal !== null} onClose={() => setEditingGoal(null)} title={editingGoal === "new" ? "New goal" : "Edit goal"} size="sm">
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <Input label="Goal title" placeholder="e.g. Walk 8,000 steps daily" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} error={errors.title} required />
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
          <div className="grid grid-cols-2 gap-3">
            <Input label="Current" type="number" min={0} value={form.currentValue} onChange={(e) => setForm((f) => ({ ...f, currentValue: e.target.value }))} error={errors.currentValue} />
            <Input label="Target" type="number" min={0} placeholder="e.g. 8000" value={form.targetValue} onChange={(e) => setForm((f) => ({ ...f, targetValue: e.target.value }))} error={errors.targetValue} required />
          </div>
          <Input label="Unit" placeholder="e.g. steps, hrs, L" value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} error={errors.unit} required />
          <Input label="Reminder (optional)" placeholder="e.g. 10:30 PM wind-down" value={form.reminder} onChange={(e) => setForm((f) => ({ ...f, reminder: e.target.value }))} />
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : editingGoal === "new" ? "Create goal" : "Save changes"}</Button>
        </form>
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
