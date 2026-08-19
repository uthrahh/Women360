import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { nutritionService } from "@/services/nutritionService";
import type { NutritionSummary } from "@/types";
import { Card, CardBody } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { LoadingState } from "@/components/ui/states";
import { useToast } from "@/components/ui/Toast";
import { Droplet, Plus } from "lucide-react";

export default function NutritionPage() {
  const [data, setData] = useState<NutritionSummary | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const toast = useToast();

  useEffect(() => {
    nutritionService.getToday().then(setData);
  }, []);

  if (!data) return <LoadingState label="Loading nutrition" />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">Nutrition</h1>
          <p className="text-[var(--w360-text-muted)] mt-1">Meals, hydration and the essentials — kept simple.</p>
        </div>
        <Button onClick={() => setAddOpen(true)}><Plus size={16} /> Add meal</Button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Hydration" value={`${data.hydrationMl}ml`} goal={`of ${data.hydrationGoalMl}ml`} pct={(data.hydrationMl / data.hydrationGoalMl) * 100} icon={<Droplet size={16} />} />
        <MetricCard label="Protein" value={`${data.proteinG}g`} goal={`of ${data.proteinGoalG}g`} pct={(data.proteinG / data.proteinGoalG) * 100} />
        <MetricCard label="Fibre" value={`${data.fibreG}g`} goal={`of ${data.fibreGoalG}g`} pct={(data.fibreG / data.fibreGoalG) * 100} />
        <MetricCard label="Fruit & veg" value={`${data.fruitVeg}`} goal={`of ${data.fruitVegGoal} servings`} pct={(data.fruitVeg / data.fruitVegGoal) * 100} />
      </div>

      <section>
        <h2 className="font-display text-lg font-semibold mb-3">Today's meals</h2>
        <Card>
          <CardBody className="p-0 divide-y divide-[var(--w360-border)]">
            {data.meals.map((m) => (
              <div key={m.id} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-sm font-medium">{m.name}</p>
                  <p className="text-xs text-[var(--w360-text-muted)] mt-0.5">{m.time} · {m.servings}</p>
                </div>
                <div className="text-right text-sm tabular-nums text-[var(--w360-text-muted)]">
                  {m.calories} kcal · {m.protein}g protein
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      </section>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add meal" size="sm">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setAddOpen(false);
            toast.show("Meal logged");
          }}
        >
          <Input label="Meal name" name="name" placeholder="e.g. Lentil soup" required />
          <Input label="Quantity" name="qty" placeholder="e.g. 1 bowl" required />
          <Button type="submit">Save meal</Button>
        </form>
      </Modal>
    </div>
  );
}

function MetricCard({ label, value, goal, pct, icon }: { label: string; value: string; goal: string; pct: number; icon?: ReactNode }) {
  return (
    <Card>
      <CardBody className="pt-5">
        <div className="flex items-center gap-1.5 text-[var(--w360-text-muted)] text-xs mb-1">{icon}{label}</div>
        <p className="text-xl font-display font-semibold tabular-nums">{value}</p>
        <p className="text-xs text-[var(--w360-text-muted)] mb-2">{goal}</p>
        <ProgressBar value={pct} />
      </CardBody>
    </Card>
  );
}
