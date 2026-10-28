import { useMemo } from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { DurationField } from "@/components/ui/DurationField";
import { NumberField } from "@/components/ui/NumberField";
import { effortOf, estimateCalories, type FieldsValue } from "@/lib/activity";
import type { ActivityCatalog, CatalogActivity } from "@/types";

const selectClass =
  "px-3.5 py-3 rounded-xl border border-[var(--w360-border)] bg-[var(--w360-bg-raised)] text-[var(--w360-text)] text-sm senior:text-lg senior:py-3.5";

/**
 * The activity, how hard, how long, and (only where the activity has them) distance or
 * sets, plus a live calorie estimate. Choosing the activity decides everything else:
 * the effort levels are that activity's own, and a field that doesn't apply isn't shown.
 */
export function ActivityFields({
  catalog,
  weightKg,
  value,
  onChange,
  withExtras = true,
  idPrefix,
}: {
  catalog: ActivityCatalog;
  weightKg: number | null;
  value: FieldsValue;
  onChange: (next: FieldsValue) => void;
  withExtras?: boolean;
  idPrefix: string;
}) {
  const groups = useMemo(() => {
    const byGroup = new Map<string, CatalogActivity[]>();
    for (const a of catalog.activities) byGroup.set(a.group, [...(byGroup.get(a.group) ?? []), a]);
    return [...byGroup.entries()];
  }, [catalog]);

  const activity = catalog.activities.find((a) => a.code === value.code);
  const level = activity?.levels.find((l) => effortOf(l.key) === value.effort);

  function pickActivity(code: string) {
    const next = catalog.activities.find((a) => a.code === code);
    if (!next) return onChange({ ...value, code: "", effort: "" });
    const keep = next.levels.find((l) => effortOf(l.key) === value.effort);
    // One level: nothing to choose. Otherwise keep her effort if this activity has it, else start at moderate.
    const fallback = next.levels.length === 1 ? next.levels[0] : next.levels.find((l) => l.key === "MODERATE") ?? next.levels[0];
    onChange({
      ...value,
      code,
      effort: effortOf((keep ?? fallback).key),
      distance: next.extras.includes("distanceKm") ? value.distance : "",
      sets: next.extras.includes("sets") ? value.sets : "",
    });
  }

  const kcal = estimateCalories(level?.met, weightKg, value.minutes ?? 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${idPrefix}-activity`} className="text-sm font-medium">Activity</label>
        <select id={`${idPrefix}-activity`} value={value.code} onChange={(e) => pickActivity(e.target.value)} className={selectClass} required>
          <option value="">Choose an activity</option>
          {groups.map(([group, items]) => (
            <optgroup key={group} label={group}>
              {items.map((a) => <option key={a.code} value={a.code}>{a.label}</option>)}
            </optgroup>
          ))}
        </select>
      </div>

      {activity && (
        <fieldset>
          <legend className="text-sm font-medium mb-1.5">{activity.levels.length > 1 ? "How hard?" : "Effort"}</legend>
          {activity.levels.length > 1 ? (
            <div className="flex flex-col gap-2" role="radiogroup">
              {activity.levels.map((l) => {
                const selected = effortOf(l.key) === value.effort;
                return (
                  <button
                    key={l.key}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => onChange({ ...value, effort: effortOf(l.key) })}
                    className={clsx(
                      "text-left rounded-xl border px-3.5 py-2.5 text-sm senior:text-lg transition-colors",
                      selected ? "border-maroon-700 bg-[var(--w360-tint)] dark:border-maroon-300" : "border-[var(--w360-border)] hover:border-maroon-400"
                    )}
                  >
                    {l.label}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm senior:text-lg text-[var(--w360-text-muted)]">{activity.levels[0].label}</p>
          )}
        </fieldset>
      )}

      <DurationField label="Duration" value={value.minutes} onChange={(minutes) => onChange({ ...value, minutes })} hint="Type it in, or use the arrows." />

      {withExtras && activity?.extras.includes("distanceKm") && (
        <NumberField label="Distance" suffix="km" optional min={0} max={500} step={0.1} startAt={5} value={value.distance} onChange={(distance) => onChange({ ...value, distance })} />
      )}
      {withExtras && activity?.extras.includes("sets") && (
        <NumberField label="Total sets" optional min={1} max={200} step={1} startAt={10} value={value.sets} onChange={(sets) => onChange({ ...value, sets })} />
      )}

      {activity && value.minutes ? (
        <p className="text-sm rounded-xl bg-[var(--w360-bg-warm)] px-3.5 py-2.5" aria-live="polite">
          {kcal !== null ? (
            <>
              About <span className="font-semibold tabular-nums">{kcal} kcal</span>
              <span className="block text-xs text-[var(--w360-text-muted)] mt-0.5">
                An estimate from your weight ({weightKg} kg) and this effort. It can't know your fitness or the terrain.
              </span>
            </>
          ) : (
            <span className="text-[var(--w360-text-muted)]">
              Log your weight under <Link to="/app/health" className="underline underline-offset-2">Health, Physical health</Link> to see calories.
            </span>
          )}
        </p>
      ) : null}
    </div>
  );
}
