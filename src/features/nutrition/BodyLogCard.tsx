import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Coffee, Wine, Plus } from "lucide-react";
import { bodyService } from "@/services/bodyService";
import { localDateISO } from "@/services/mappers";
import type { BodyKind, BodyLogEntry, BowelDetail } from "@/types";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

const BOWEL: { value: BowelDetail; label: string }[] = [
  { value: "hard", label: "Hard" },
  { value: "normal", label: "Normal" },
  { value: "loose", label: "Loose" },
];

/**
 * Caffeine, alcohol and digestion for today: one tap each, Undo on the toast.
 * Women asked to keep these beside food and water instead of in three other apps; the counts feed "Patterns".
 * No targets, colours or judgement: a count is a count.
 */
export function BodyLogCard() {
  const [rows, setRows] = useState<BodyLogEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const day = localDateISO();

  const load = useCallback(() => {
    setFailed(false);
    bodyService.list(day).then(setRows).catch(() => setFailed(true));
  }, [day]);
  useEffect(load, [load]);

  async function add(kind: BodyKind, detail?: BowelDetail) {
    if (busy) return;
    setBusy(true);
    try {
      const entry = await bodyService.log(day, kind, detail);
      setRows((r) => [...(r ?? []), entry]);
      const what = kind === "caffeine" ? "Caffeine drink" : kind === "alcohol" ? "Alcoholic drink" : "Bowel movement";
      toast.show(`${what} logged`, {
        action: {
          label: "Undo",
          onClick: () => {
            setRows((r) => (r ?? []).filter((x) => x.id !== entry.id));
            bodyService.remove(entry.id).catch(() => {
              toast.show("Couldn't undo that. Please try again.", { tone: "error" });
              load();
            });
          },
        },
      });
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't log that. Please try again.", { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  const count = (kind: BodyKind) => (rows ?? []).filter((r) => r.kind === kind).length;
  const bowel = (rows ?? []).filter((r) => r.kind === "bowel");

  return (
    <Card className="sm:col-span-2 lg:col-span-3">
      <CardBody className="pt-5">
        <h2 className="text-sm font-medium">Caffeine, alcohol &amp; digestion</h2>
        {failed ? (
          <p className="text-sm text-[var(--w360-text-muted)] mt-2">
            Couldn&apos;t load today&apos;s entries.{" "}
            <button type="button" className="underline" onClick={load}>Try again</button>
          </p>
        ) : (
          <div className="grid sm:grid-cols-3 gap-4 mt-3">
            <Counter icon={<Coffee size={16} aria-hidden />} label="Caffeine drinks" value={rows ? count("caffeine") : null} onAdd={() => add("caffeine")} addLabel="Add a caffeine drink" disabled={busy || !rows} />
            <Counter icon={<Wine size={16} aria-hidden />} label="Alcoholic drinks" value={rows ? count("alcohol") : null} onAdd={() => add("alcohol")} addLabel="Add an alcoholic drink" disabled={busy || !rows} />
            <div>
              <p className="text-xs text-[var(--w360-text-muted)]">Bowel movements today</p>
              <p className="text-xl font-display font-semibold tabular-nums mt-0.5" aria-live="polite">
                {rows ? bowel.length : "–"}
                {bowel.length > 0 && (
                  <span className="text-xs font-sans font-normal text-[var(--w360-text-muted)] ml-2">
                    {bowel.map((b) => BOWEL.find((x) => x.value === b.detail)?.label ?? "Logged").join(", ")}
                  </span>
                )}
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2" role="group" aria-label="Log a bowel movement">
                {BOWEL.map((b) => (
                  <button
                    key={b.value}
                    type="button"
                    disabled={busy || !rows}
                    onClick={() => add("bowel", b.value)}
                    className="px-3 py-1.5 rounded-full border border-[var(--w360-border)] text-sm senior:text-base hover:border-maroon-400 hover:text-maroon-700 dark:hover:text-maroon-300 transition-colors disabled:opacity-50"
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function Counter({ icon, label, value, onAdd, addLabel, disabled }: { icon: ReactNode; label: string; value: number | null; onAdd: () => void; addLabel: string; disabled: boolean }) {
  return (
    <div>
      <p className="text-xs text-[var(--w360-text-muted)] flex items-center gap-1.5">{icon}{label} today</p>
      <p className="text-xl font-display font-semibold tabular-nums mt-0.5" aria-live="polite">{value ?? "–"}</p>
      <Button variant="secondary" size="sm" className="mt-2 w-fit" onClick={onAdd} disabled={disabled} aria-label={addLabel}>
        <Plus size={14} /> 1
      </Button>
    </div>
  );
}
