import { useEffect, useState, type FormEvent } from "react";
import { goalService } from "@/services/goalService";
import type { Goal } from "@/types";
import { Card, CardBody } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { LoadingState, EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/Toast";
import { CheckCircle2, Plus } from "lucide-react";

const CATEGORIES: Goal["category"][] = ["sleep", "activity", "hydration", "nutrition", "strength", "cycle", "mobility"];

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[] | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const toast = useToast();

  useEffect(() => {
    goalService.list().then(setGoals);
  }, []);

  if (!goals) return <LoadingState label="Loading goals" />;

  function handleAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const title = String(form.get("title") ?? "");
    const category = String(form.get("category") ?? "activity") as Goal["category"];
    const target = String(form.get("target") ?? "");
    goalService.create({ title, category, target }).then((goal) => {
      setGoals((g) => (g ? [goal, ...g] : [goal]));
      setAddOpen(false);
      toast.show("Goal created");
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">Goals</h1>
          <p className="text-[var(--w360-text-muted)] mt-1">Small, trackable commitments you're building on.</p>
        </div>
        <Button onClick={() => setAddOpen(true)}><Plus size={16} /> New goal</Button>
      </div>

      {goals.length === 0 ? (
        <EmptyState title="No goals yet" description="Set your first goal to start tracking progress over time." />
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {goals.map((g) => (
            <Card key={g.id}>
              <CardBody className="pt-5">
                <div className="flex items-start justify-between">
                  <p className="font-medium">{g.title}</p>
                  {g.completed && <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />}
                </div>
                <Badge tone="neutral" className="mt-2 capitalize">{g.category}</Badge>
                <p className="text-xs text-[var(--w360-text-muted)] mt-3 mb-1.5">Target: {g.target}</p>
                <ProgressBar value={g.progress} />
                <p className="text-xs text-[var(--w360-text-muted)] mt-2">{g.progress}% complete{g.reminder ? ` · Reminder: ${g.reminder}` : ""}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="New goal" size="sm">
        <form className="flex flex-col gap-4" onSubmit={handleAdd}>
          <Input label="Goal title" name="title" placeholder="e.g. Walk 8,000 steps daily" required />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="category" className="text-sm font-medium">Category</label>
            <select
              id="category"
              name="category"
              defaultValue="activity"
              className="px-3.5 py-2.5 rounded border border-[var(--w360-border)] bg-[var(--w360-bg-raised)] text-[var(--w360-text)] text-sm capitalize"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c} className="capitalize">{c}</option>
              ))}
            </select>
          </div>
          <Input label="Target" name="target" placeholder="e.g. 8,000 steps" required />
          <Button type="submit">Create goal</Button>
        </form>
      </Modal>
    </div>
  );
}
