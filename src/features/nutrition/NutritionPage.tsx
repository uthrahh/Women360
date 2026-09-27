import type { FormEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import { nutritionService } from "@/services/nutritionService";
import { hasAtMostOneDecimal, to12Hour, to24Hour } from "@/services/mappers";
import type { MealEntry, NutritionSummary } from "@/types";
import { Card, CardBody } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LoadingState, EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/Toast";
import { Droplet, Apple, Plus, Pencil, Trash2 } from "lucide-react";

const HYDRATION_STEP_ML = 250;

// A fixed, unit-labeled vocabulary for how a meal was measured — replaces a
// free-text "e.g. 1 bowl" field, which is exactly the kind of unverified,
// inconsistent entry nutrition-tracking research flags as a data-quality
// problem (one person's "1 bowl" is another's "2 bowls" for the same food).
// Units that naturally pluralize get an "s" in the composed/displayed
// string when the amount isn't 1; abbreviations (g, ml, tbsp, tsp) don't.
const SERVING_UNITS = [
  { value: "serving", label: "serving", plural: "servings" },
  { value: "cup", label: "cup", plural: "cups" },
  { value: "bowl", label: "bowl", plural: "bowls" },
  { value: "plate", label: "plate", plural: "plates" },
  { value: "glass", label: "glass", plural: "glasses" },
  { value: "piece", label: "piece", plural: "pieces" },
  { value: "slice", label: "slice", plural: "slices" },
  { value: "tbsp", label: "tablespoon (tbsp)", plural: "tbsp" },
  { value: "tsp", label: "teaspoon (tsp)", plural: "tsp" },
  { value: "g", label: "gram (g)", plural: "g" },
  { value: "ml", label: "milliliter (ml)", plural: "ml" },
] as const;
const DEFAULT_SERVING_UNIT = "serving";

function formatServings(amount: string, unit: string): string {
  const n = Number(amount);
  const def = SERVING_UNITS.find((u) => u.value === unit) ?? SERVING_UNITS[0];
  const word = n === 1 || Number.isNaN(n) ? def.label.replace(/\s*\(.*\)/, "") : def.plural;
  return `${amount} ${word}`;
}

// Best-effort parse of a legacy or composed "servings" string back into an
// amount + a known unit, so existing meals (including ones logged before
// this structure existed) still open cleanly in the edit form. A quantity
// that doesn't match a known unit falls back to a generic "serving" rather
// than leaving the amount field holding non-numeric text.
function parseServings(servings: string): { amount: string; unit: string } {
  const match = /^(\d+(?:\.\d+)?)\s*(.*)$/.exec(servings.trim());
  if (!match) return { amount: "1", unit: DEFAULT_SERVING_UNIT };
  const amount = match[1];
  const rest = match[2].trim().toLowerCase();
  const found = SERVING_UNITS.find((u) => u.value === rest || u.plural === rest);
  return { amount, unit: found?.value ?? DEFAULT_SERVING_UNIT };
}

interface MealFormValues {
  name: string;
  time: string; // 24-hour "HH:MM" for the native input
  servingAmount: string;
  servingUnit: string;
  calories: string;
  protein: string;
  fibre: string;
  carbs: string;
  fat: string;
  notes: string;
}

function emptyForm(): MealFormValues {
  return { name: "", time: "12:00", servingAmount: "1", servingUnit: DEFAULT_SERVING_UNIT, calories: "", protein: "", fibre: "", carbs: "", fat: "", notes: "" };
}

function mealToForm(m: MealEntry): MealFormValues {
  const { amount, unit } = parseServings(m.servings);
  return {
    name: m.name,
    time: to24Hour(m.time),
    servingAmount: amount,
    servingUnit: unit,
    calories: String(m.calories),
    protein: m.protein ? String(m.protein) : "",
    fibre: m.fibre ? String(m.fibre) : "",
    carbs: m.carbs !== undefined ? String(m.carbs) : "",
    fat: m.fat !== undefined ? String(m.fat) : "",
    notes: m.notes ?? "",
  };
}

export default function NutritionPage() {
  const [data, setData] = useState<NutritionSummary | null>(null);
  const [recentMeals, setRecentMeals] = useState<MealEntry[]>([]);
  const [editingMeal, setEditingMeal] = useState<MealEntry | "new" | null>(null);
  const [form, setForm] = useState<MealFormValues>(emptyForm());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MealEntry | null>(null);
  const toast = useToast();

  useEffect(() => {
    nutritionService.getToday().then(setData);
    nutritionService.getRecentMeals().then(setRecentMeals);
  }, []);

  if (!data) return <LoadingState label="Loading nutrition" />;

  function openAdd() {
    setForm(emptyForm());
    setErrors({});
    setEditingMeal("new");
  }

  // Pre-fills the Add meal form from something already logged before —
  // still editable and still requires a tap to confirm, never silently
  // re-logs — so a familiar breakfast doesn't mean retyping six fields.
  function openLogAgain(meal: MealEntry) {
    setForm({ ...mealToForm(meal), time: new Date().toTimeString().slice(0, 5) });
    setErrors({});
    setEditingMeal("new");
  }

  function openEdit(meal: MealEntry) {
    setForm(mealToForm(meal));
    setErrors({});
    setEditingMeal(meal);
  }

  function validate(values: MealFormValues): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!values.name.trim()) errs.name = "Enter a meal or food name.";
    const amount = Number(values.servingAmount);
    if (values.servingAmount === "" || Number.isNaN(amount) || amount <= 0) {
      errs.servingAmount = "Enter an amount greater than 0.";
    }
    if (!values.time) errs.time = "Enter a time.";
    const calories = Number(values.calories);
    if (values.calories === "" || Number.isNaN(calories) || calories < 0) {
      errs.calories = "Enter calories as a number of 0 or more.";
    } else if (!hasAtMostOneDecimal(calories)) {
      errs.calories = "Use at most one decimal place, e.g. 420 or 420.5.";
    }
    for (const [field, label] of [["protein", "Protein"], ["fibre", "Fibre"], ["carbs", "Carbs"], ["fat", "Fat"]] as const) {
      const raw = values[field];
      if (raw === "") continue;
      const num = Number(raw);
      if (Number.isNaN(num) || num < 0) {
        errs[field] = `${label} can't be negative.`;
      } else if (!hasAtMostOneDecimal(num)) {
        errs[field] = `Use at most one decimal place, e.g. 12 or 12.3.`;
      }
    }
    return errs;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const meal = {
      name: form.name.trim(),
      time: to12Hour(form.time),
      servings: formatServings(form.servingAmount, form.servingUnit),
      calories: Number(form.calories),
      protein: form.protein ? Number(form.protein) : 0,
      fibre: form.fibre ? Number(form.fibre) : 0,
      carbs: form.carbs ? Number(form.carbs) : undefined,
      fat: form.fat ? Number(form.fat) : undefined,
      notes: form.notes.trim() || undefined,
    };

    setSaving(true);
    try {
      if (editingMeal === "new") {
        await nutritionService.addMeal(meal);
        toast.show("Meal logged");
      } else if (editingMeal) {
        await nutritionService.updateMeal(editingMeal.id, meal);
        toast.show("Meal updated");
      }
      // Refetch rather than hand-patch local state: adding/editing a meal
      // changes the protein/fibre totals shown above, not just the list.
      setData(await nutritionService.getToday());
      nutritionService.getRecentMeals().then(setRecentMeals);
      setEditingMeal(null);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't save that meal. Please try again.", { tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    try {
      await nutritionService.deleteMeal(id);
      setData(await nutritionService.getToday());
      toast.show("Meal deleted");
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't delete that meal. Please try again.", { tone: "error" });
    } finally {
      setDeleteTarget(null);
    }
  }

  async function logHydration(amountMl: number) {
    try {
      await nutritionService.logHydration(amountMl);
      const refreshed = await nutritionService.getToday();
      setData(refreshed);
      toast.show(`${amountMl}ml logged`);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't log hydration. Please try again.", { tone: "error" });
    }
  }

  async function logFruitVeg() {
    try {
      await nutritionService.logFruitVeg(1);
      const refreshed = await nutritionService.getToday();
      setData(refreshed);
      toast.show("Serving logged");
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't log that. Please try again.", { tone: "error" });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Nutrition</h1>
          <p className="text-[var(--w360-text-muted)] mt-1">Meals, hydration and the essentials — kept simple.</p>
        </div>
        <Button onClick={openAdd}><Plus size={16} /> Add meal</Button>
      </div>

      {recentMeals.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[var(--w360-text-muted)]">Log again:</span>
          {recentMeals.map((m) => (
            <button
              key={m.id}
              onClick={() => openLogAgain(m)}
              className="text-xs px-3 py-1.5 rounded-full border border-[var(--w360-border)] hover:border-maroon-400 hover:text-maroon-700 dark:hover:text-maroon-300 transition-colors senior:text-sm"
            >
              {m.name}
            </button>
          ))}
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Card>
          <CardBody className="pt-5">
            <p className="text-xs text-[var(--w360-text-muted)] mb-1">Calories</p>
            <p className="text-xl font-display font-semibold tabular-nums">{data.calories} kcal</p>
            <p className="text-xs text-[var(--w360-text-muted)] mt-0.5">logged today · {data.proteinG}g protein · {data.carbsG}g carbs · {data.fatG}g fat</p>
            <p className="text-[11px] text-[var(--w360-text-muted)] italic mt-1.5">Estimates based on what you log — not lab-measured.</p>
          </CardBody>
        </Card>
        <MetricCard label="Hydration" value={`${data.hydrationMl}ml`} goal={`of ${data.hydrationGoalMl}ml`} pct={(data.hydrationMl / data.hydrationGoalMl) * 100} icon={<Droplet size={16} />}>
          <Button variant="secondary" size="sm" className="mt-3 w-fit" onClick={() => logHydration(HYDRATION_STEP_ML)}>
            <Plus size={14} /> {HYDRATION_STEP_ML}ml
          </Button>
        </MetricCard>
        <MetricCard label="Fruit & veg" value={`${data.fruitVeg}`} goal={`of ${data.fruitVegGoal} servings`} pct={(data.fruitVeg / data.fruitVegGoal) * 100} icon={<Apple size={16} />}>
          <Button variant="secondary" size="sm" className="mt-3 w-fit" onClick={logFruitVeg}>
            <Plus size={14} /> 1 serving
          </Button>
        </MetricCard>
        <MetricCard label="Protein" value={`${data.proteinG}g`} goal={`of ${data.proteinGoalG}g`} pct={(data.proteinG / data.proteinGoalG) * 100} />
        <MetricCard label="Fibre" value={`${data.fibreG}g`} goal={`of ${data.fibreGoalG}g`} pct={(data.fibreG / data.fibreGoalG) * 100} />
      </div>

      <section>
        <h2 className="font-display text-lg font-semibold mb-3">Today's meals</h2>
        {data.meals.length === 0 ? (
          <EmptyState
            title="No meals logged yet"
            description="Log your first meal to start tracking today's nutrition."
            action={<Button onClick={openAdd}><Plus size={16} /> Log your first meal</Button>}
          />
        ) : (
          <Card>
            <CardBody className="p-0 divide-y divide-[var(--w360-border)]">
              {data.meals.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3 px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{m.name}</p>
                    <p className="text-xs text-[var(--w360-text-muted)] mt-0.5">{m.time} · {m.servings}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right text-sm tabular-nums text-[var(--w360-text-muted)]">
                      {m.calories} kcal · {m.protein}g protein
                    </div>
                    <button
                      onClick={() => openEdit(m)}
                      aria-label={`Edit ${m.name}`}
                      className="p-1.5 rounded hover:bg-black/[0.05] dark:hover:bg-white/[0.08] text-[var(--w360-text-muted)]"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(m)}
                      aria-label={`Delete ${m.name}`}
                      className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950/40 text-[var(--w360-text-muted)] hover:text-red-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>
        )}
      </section>

      <Modal open={editingMeal !== null} onClose={() => setEditingMeal(null)} title={editingMeal === "new" ? "Add meal" : "Edit meal"} size="sm">
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <Input label="Meal / food name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} error={errors.name} required />
          <Input label="Time" type="time" value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))} error={errors.time} required />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Amount"
              type="number"
              min={0.25}
              step={0.25}
              inputMode="decimal"
              value={form.servingAmount}
              onChange={(e) => setForm((f) => ({ ...f, servingAmount: e.target.value }))}
              error={errors.servingAmount}
              required
            />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="serving-unit" className="text-sm font-medium senior:text-lg">Unit</label>
              <select
                id="serving-unit"
                value={form.servingUnit}
                onChange={(e) => setForm((f) => ({ ...f, servingUnit: e.target.value }))}
                className="px-3.5 py-2.5 rounded border border-[var(--w360-border)] bg-[var(--w360-bg-raised)] text-[var(--w360-text)] text-sm senior:text-lg senior:py-3.5"
              >
                {SERVING_UNITS.map((u) => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </select>
            </div>
          </div>
          <Input label="Calories (kcal)" type="number" min={0} step={0.1} inputMode="decimal" value={form.calories} onChange={(e) => setForm((f) => ({ ...f, calories: e.target.value }))} error={errors.calories} hint="Up to one decimal place, e.g. 420.5" required />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Protein (g)" type="number" min={0} step={0.1} inputMode="decimal" value={form.protein} onChange={(e) => setForm((f) => ({ ...f, protein: e.target.value }))} error={errors.protein} />
            <Input label="Fibre (g)" type="number" min={0} step={0.1} inputMode="decimal" value={form.fibre} onChange={(e) => setForm((f) => ({ ...f, fibre: e.target.value }))} error={errors.fibre} />
            <Input label="Carbs (g)" type="number" min={0} step={0.1} inputMode="decimal" value={form.carbs} onChange={(e) => setForm((f) => ({ ...f, carbs: e.target.value }))} error={errors.carbs} />
            <Input label="Fat (g)" type="number" min={0} step={0.1} inputMode="decimal" value={form.fat} onChange={(e) => setForm((f) => ({ ...f, fat: e.target.value }))} error={errors.fat} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="meal-notes" className="text-sm font-medium">Notes (optional)</label>
            <textarea
              id="meal-notes"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="px-3.5 py-2.5 rounded border border-[var(--w360-border)] bg-[var(--w360-bg-raised)] text-[var(--w360-text)] text-sm senior:text-lg"
            />
          </div>
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save meal"}</Button>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete this meal?"
        description={deleteTarget ? `"${deleteTarget.name}" will be removed from today's log.` : undefined}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function MetricCard({ label, value, goal, pct, icon, children }: { label: string; value: string; goal: string; pct: number; icon?: ReactNode; children?: ReactNode }) {
  return (
    <Card>
      <CardBody className="pt-5">
        <div className="flex items-center gap-1.5 text-[var(--w360-text-muted)] text-xs mb-1">{icon}{label}</div>
        <p className="text-xl font-display font-semibold tabular-nums">{value}</p>
        <p className="text-xs text-[var(--w360-text-muted)] mb-2">{goal}</p>
        <ProgressBar value={pct} />
        {children}
      </CardBody>
    </Card>
  );
}
