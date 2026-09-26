import { useState } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { FactorReport } from "@/types";

/**
 * Renders a cross-domain "explain this" report on demand — collapsed by
 * default so it never becomes a daily scoreboard, and only fetched when the
 * user actually taps it. Used by Cycle (a late period) and Wellbeing (a
 * logged low mood) to surface possible contributing factors from the
 * user's own data, never a single default assumption.
 */
export function ExplainThisCard({
  title,
  buttonLabel = "Explain this",
  fetchReport,
}: {
  title: string;
  buttonLabel?: string;
  fetchReport: () => Promise<FactorReport>;
}) {
  const [open, setOpen] = useState(false);
  const [report, setReport] = useState<FactorReport | null>(null);
  const [loading, setLoading] = useState(false);

  function handleToggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (report || loading) return;
    setLoading(true);
    fetchReport().then(
      (r) => {
        setReport(r);
        setLoading(false);
      },
      () => setLoading(false)
    );
  }

  return (
    <Card>
      <CardBody className="pt-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium senior:text-lg">{title}</p>
          <Button variant="secondary" size="sm" onClick={handleToggle}>
            {open ? "Hide" : buttonLabel}
          </Button>
        </div>
        {open && (
          <div className="mt-3 flex flex-col gap-3">
            {loading && <p className="text-sm text-[var(--w360-text-muted)]">Looking at your recent logs…</p>}
            {report && report.factors.length === 0 && (
              <p className="text-sm text-[var(--w360-text-muted)]">
                Not enough logged data yet to spot a pattern here — keep logging and check back.
              </p>
            )}
            {report?.factors.map((f) => (
              <div key={f.label} className="border-l-2 border-maroon-300 dark:border-maroon-600 pl-3">
                <p className="text-sm font-medium senior:text-base">{f.label}</p>
                <p className="text-xs text-[var(--w360-text-muted)] senior:text-sm mt-0.5">{f.detail}</p>
              </div>
            ))}
            {report && (
              <p className="text-xs text-[var(--w360-text-muted)] italic mt-1">{report.disclaimer}</p>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
