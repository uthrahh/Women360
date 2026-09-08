import { useEffect, useState } from "react";
import { reportService } from "@/services/reportService";
import { generateHealthReportPdf } from "@/lib/generateHealthReportPdf";
import type { ReportRecord } from "@/types";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LoadingState, EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/Toast";
import { FileText, Download, Eye, AlertCircle } from "lucide-react";

const PERIODS = [
  { days: 7, label: "Last 7 days" },
  { days: 30, label: "Last 30 days" },
  { days: 90, label: "Last 90 days" },
];

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportRecord[] | null>(null);
  const [rangeDays, setRangeDays] = useState(30);
  const [generating, setGenerating] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    reportService.list().then(setReports, () => setLoadError(true));
  }, []);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const label = PERIODS.find((p) => p.days === rangeDays)?.label ?? `Last ${rangeDays} days`;
      const r = await reportService.generate("Health Report", label, rangeDays);
      setReports((prev) => [r, ...(prev ?? [])]);
      toast.show("Report generated");
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't generate that report. Please try again.", { tone: "error" });
    } finally {
      setGenerating(false);
    }
  }

  // Builds the real PDF from the report's own stored data snapshot — the
  // one source of truth — then either opens it for viewing/printing or
  // downloads it, without a second, separate render path for each.
  async function buildPdf(r: ReportRecord) {
    const full = await reportService.getById(r.id);
    return generateHealthReportPdf(full);
  }

  async function handleView(r: ReportRecord) {
    // A tab opened *after* an await is treated as an unrequested popup by
    // most browsers and silently blocked — open a blank one synchronously,
    // inside the click's own call stack, then navigate it once the PDF is
    // ready. (Deliberately no "noopener": we need the reference back to
    // point it at the blob URL, and it's a same-origin document we just
    // generated ourselves, not third-party content.)
    const win = window.open("", "_blank");
    setBusyId(r.id);
    try {
      const doc = await buildPdf(r);
      if (win) {
        win.location.href = String(doc.output("bloburl"));
      } else {
        toast.show("Your browser blocked the report from opening. Please allow pop-ups for this site, or use Download instead.", { tone: "error" });
      }
    } catch (err) {
      win?.close();
      toast.show(err instanceof Error ? err.message : "Couldn't open that report. Please try again.", { tone: "error" });
    } finally {
      setBusyId(null);
    }
  }

  async function handleDownload(r: ReportRecord) {
    setBusyId(r.id);
    try {
      const doc = await buildPdf(r);
      doc.save(`${r.title.replace(/[^\w-]+/g, "_")}_${r.id.slice(0, 6)}.pdf`);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't download that report. Please try again.", { tone: "error" });
    } finally {
      setBusyId(null);
    }
  }

  if (loadError) {
    return (
      <EmptyState
        title="Couldn't load your reports"
        description="Something went wrong loading your reports. Please try again."
        action={<Button onClick={() => { setLoadError(false); reportService.list().then(setReports, () => setLoadError(true)); }}>Retry</Button>}
      />
    );
  }

  if (!reports) return <LoadingState label="Loading reports" />;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Reports</h1>
        <p className="text-[var(--w360-text-muted)] mt-1">A real, shareable PDF summary of your health and wellness.</p>
      </div>

      <Card>
        <CardBody className="flex flex-col sm:flex-row sm:items-end gap-4 pt-5">
          <div className="flex flex-col gap-1.5 flex-1 max-w-xs">
            <label htmlFor="report-period" className="text-sm font-medium senior:text-lg">Reporting period</label>
            <select
              id="report-period"
              value={rangeDays}
              onChange={(e) => setRangeDays(Number(e.target.value))}
              className="px-3.5 py-2.5 rounded border border-[var(--w360-border)] bg-[var(--w360-bg-raised)] text-[var(--w360-text)] text-sm senior:text-lg senior:py-3.5"
            >
              {PERIODS.map((p) => (
                <option key={p.days} value={p.days}>{p.label}</option>
              ))}
            </select>
          </div>
          <Button onClick={handleGenerate} disabled={generating} size="lg" className="sm:w-fit">
            {generating ? "Generating…" : "Generate report"}
          </Button>
        </CardBody>
      </Card>

      {reports.length === 0 ? (
        <EmptyState title="No reports yet" description="Choose a period above and generate your first health report." />
      ) : (
        <div className="flex flex-col gap-3">
          {reports.map((r) => (
            <Card key={r.id}>
              <CardBody className="flex items-center justify-between pt-5 flex-wrap gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText size={22} className="text-maroon-700 dark:text-maroon-200 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium">{r.title}</p>
                    <p className="text-xs text-[var(--w360-text-muted)]">{r.range} · Generated {new Date(r.generatedOn).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => handleView(r)} disabled={busyId === r.id}>
                    <Eye size={14} /> View
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => handleDownload(r)} disabled={busyId === r.id}>
                    <Download size={14} /> {busyId === r.id ? "Preparing…" : "Download PDF"}
                  </Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <p className="flex items-start gap-2 text-xs text-[var(--w360-text-muted)]">
        <AlertCircle size={14} className="shrink-0 mt-0.5" />
        Reports summarize data you've logged in Women360. They are not medical advice or a diagnosis.
      </p>
    </div>
  );
}
