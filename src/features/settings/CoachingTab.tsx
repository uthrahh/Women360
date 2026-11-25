import { useCallback, useEffect, useState } from "react";
import { myCoachingService } from "@/services/clientService";
import type { IntakeSection, Measurement } from "@/types/clients";
import { SPECIALITY_LABEL, shortDate } from "@/types/clients";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useToast } from "@/components/ui/Toast";

type Overview = Awaited<ReturnType<typeof myCoachingService.overview>>;
const SECTION_TITLE: Record<IntakeSection, string> = { lifestyle: "Lifestyle", medical: "Medical history", menstrual: "Menstrual history", dietary: "Diet" };
const label = (k: string) => k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).replace("24h", " (24 hours)");

/**
 * Her coaches and what they have recorded about her: her details, assessment, measurements and the plans they gave. Their working notes
 * are not shown here (they are in her data download). She can remove any coach, who then loses access at once.
 */
export function CoachingTab() {
  const [d, setD] = useState<Overview | null>(null);
  const [failed, setFailed] = useState(false);
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null);
  const toast = useToast();
  const load = useCallback(() => {
    setFailed(false);
    myCoachingService.overview().then(setD).catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);

  if (failed) return <ErrorState title="Couldn't load your coaches" onRetry={load} />;
  if (!d) return <LoadingState variant="rows" />;
  if (d.coaches.length === 0 && d.measurements.length === 0 && d.plans.length === 0) {
    return <p className="text-sm text-[var(--w360-text-muted)] py-4">You don't have a coach. If a coach adds you, they appear here with what they recorded.</p>;
  }

  const intake = Object.entries(d.intake ?? {}).filter(([, v]) => v && Object.keys(v).length > 0) as [IntakeSection, Record<string, unknown>][];
  return (
    <div className="flex flex-col gap-8 pt-2">
      <section aria-labelledby="my-coaches" className="flex flex-col gap-2">
        <h2 id="my-coaches" className="font-display text-lg font-semibold">Your coaches</h2>
        <p className="text-sm text-[var(--w360-text-muted)] measure">Each sees the parts of your record that match their speciality, and what you log in those areas.</p>
        <ul className="flex flex-col divide-y divide-[var(--w360-border)] border-y border-[var(--w360-border)]">
          {d.coaches.map((c) => (
            <li key={c.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
              <span>
                <span className="font-medium">{c.name}</span> <span className="text-sm text-[var(--w360-text-muted)]">· {c.specialities.map((s) => SPECIALITY_LABEL[s]).join(", ")}</span>
              </span>
              <Button size="sm" variant="ghost" onClick={() => setRemoving({ id: c.id, name: c.name })}>Remove<span className="sr-only"> {c.name}</span></Button>
            </li>
          ))}
        </ul>
      </section>

      {d.plans.length > 0 && (
        <section aria-labelledby="my-plans" className="flex flex-col gap-3">
          <h2 id="my-plans" className="font-display text-lg font-semibold">Plans and follow-ups</h2>
          <ul className="flex flex-col gap-4 text-sm">
            {d.plans.map((p) => (
              <li key={p.id} className="flex flex-col gap-0.5">
                <p className="font-medium tabular-nums">{shortDate(p.date)} · {SPECIALITY_LABEL[p.area]}{p.coach ? `, ${p.coach}` : ""}</p>
                {p.planGiven && <p className="whitespace-pre-line">{p.planGiven}</p>}
                {(p.targetWeightKg !== null || p.targetDate) && <p className="tabular-nums">Target: {[p.targetWeightKg !== null ? `${p.targetWeightKg} kg` : null, p.targetDate ? `by ${shortDate(p.targetDate)}` : null].filter(Boolean).join(" ")}</p>}
                {p.nextFollowUp && <p className="tabular-nums">Next follow-up: {shortDate(p.nextFollowUp)}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {d.measurements.length > 0 && (
        <section aria-labelledby="my-measure" className="flex flex-col gap-2">
          <h2 id="my-measure" className="font-display text-lg font-semibold">Measurements</h2>
          <ul className="text-sm flex flex-col gap-1 tabular-nums">
            {d.measurements.map((m: Measurement) => (
              <li key={m.id}>
                {shortDate(m.date)}: {[m.weightKg !== null ? `${m.weightKg} kg` : null, m.heightCm !== null ? `${m.heightCm} cm tall` : null, m.waistCm !== null ? `waist ${m.waistCm} cm` : null, m.hipCm !== null ? `hip ${m.hipCm} cm` : null, m.bmi !== null ? `BMI ${m.bmi}` : null].filter(Boolean).join(", ")}
              </li>
            ))}
          </ul>
        </section>
      )}

      {intake.length > 0 && (
        <section aria-labelledby="my-assess" className="flex flex-col gap-3">
          <h2 id="my-assess" className="font-display text-lg font-semibold">What your coaches recorded</h2>
          {intake.map(([section, answers]) => (
            <div key={section} className="flex flex-col gap-1">
              <h3 className="font-medium">{SECTION_TITLE[section]}</h3>
              <dl className="grid sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
                {Object.entries(answers).map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-[var(--w360-text-muted)]">{label(k)}</dt>
                    <dd className="whitespace-pre-line">{Array.isArray(v) ? (v as { time: string; food: string }[]).map((r) => `${r.time} ${r.food}`.trim()).join("; ") : String(v)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
          <p className="text-xs text-[var(--w360-text-muted)]">If something here is wrong, ask your coach to correct it.</p>
        </section>
      )}

      <ConfirmDialog
        open={removing !== null}
        title={`Remove ${removing?.name ?? ""}?`}
        description="They will no longer see your record or your logs. What they wrote stays in your record."
        confirmLabel="Remove"
        onCancel={() => setRemoving(null)}
        onConfirm={async () => {
          const r = removing;
          setRemoving(null);
          if (!r) return;
          try {
            await myCoachingService.removeCoach(r.id);
            toast.show(`${r.name} removed`);
            load();
          } catch (err) {
            toast.show(err instanceof Error ? err.message : "Couldn't remove them.", { tone: "error" });
          }
        }}
      />
    </div>
  );
}
