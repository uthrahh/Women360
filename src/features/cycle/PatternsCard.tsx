import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { conditionService } from "@/services/conditionService";
import type { HealthSignal, HealthSignals } from "@/types";

/**
 * Patterns in her own logs that cross a published guideline line, each collapsed until she
 * opens it. It shows her numbers, the line they cross, what a doctor may check and where that
 * comes from, never a diagnosis. Nothing is shown when there is nothing to say.
 */
export function PatternsCard({ refreshKey = "" }: { refreshKey?: string | number }) {
  const toast = useToast();
  const [data, setData] = useState<HealthSignals | null>(null);

  const load = useCallback(() => {
    conditionService
      .signals()
      .then((d) => {
        setData(d);
        // The server tells her once, in the app, the first time a pattern appears: let the bell know.
        if (d.signals.length > 0) window.dispatchEvent(new Event("w360:notifications-changed"));
      })
      .catch(() => setData(null));
  }, []);
  useEffect(load, [load, refreshKey]);

  async function setAside(signal: HealthSignal) {
    try {
      await conditionService.dismiss(signal.key);
      setData((d) => (d ? { ...d, signals: d.signals.filter((s) => s.key !== signal.key) } : d));
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't do that. Please try again.", { tone: "error" });
    }
  }

  if (!data || data.signals.length === 0) return null;

  return (
    <section aria-label="Worth discussing with a doctor">
      <Card>
        <CardBody className="pt-5 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="warning">Worth discussing with a doctor</Badge>
            <p className="text-sm senior:text-base text-[var(--w360-text-muted)]">
              From your own logs. This is a pattern, not a diagnosis.
            </p>
          </div>
          <div className="flex flex-col divide-y divide-[var(--w360-border)] rounded-xl border border-[var(--w360-border)]">
            {data.signals.map((s) => (
              <details key={s.key} className="px-4">
                <summary className="cursor-pointer py-3 text-sm senior:text-lg font-medium">{s.title}</summary>
                <div className="pb-4 flex flex-col gap-3 text-sm senior:text-base">
                  <ul className="list-disc pl-5 flex flex-col gap-1">
                    {s.evidence.map((e) => <li key={e}>{e}</li>)}
                  </ul>
                  <p className="text-[var(--w360-text-muted)]">{s.guideline}</p>
                  <div>
                    <p className="font-medium">A doctor may look at</p>
                    <ul className="list-disc pl-5 text-[var(--w360-text-muted)] flex flex-col gap-0.5">
                      {s.mayCheck.map((c) => <li key={c}>{c}</li>)}
                    </ul>
                  </div>
                  <p>{s.nextStep}</p>
                  <p className="text-xs senior:text-base text-[var(--w360-text-muted)]">
                    Source:{" "}
                    {s.sources.map((src, i) => (
                      <span key={src.url}>
                        {i > 0 && "; "}
                        <a href={src.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">{src.label}</a>
                      </span>
                    ))}
                    . {data.review.note}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Link to="/app/health" className="inline-flex"><Button size="sm">Add a check-up</Button></Link>
                    <Button size="sm" variant="ghost" onClick={() => setAside(s)}>Not now</Button>
                  </div>
                </div>
              </details>
            ))}
          </div>
        </CardBody>
      </Card>
    </section>
  );
}
