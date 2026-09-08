import { useEffect, useState } from "react";
import { reportService } from "@/services/reportService";
import type { ReportRecord } from "@/types";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LoadingState, EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/Toast";
import { FileText, Download } from "lucide-react";

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportRecord[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    reportService.list().then(setReports);
  }, []);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const r = await reportService.generate("Health Report", "Last 30 days");
      setReports((prev) => [r, ...(prev ?? [])]);
      toast.show("Report generated");
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't generate that report. Please try again.", { tone: "error" });
    } finally {
      setGenerating(false);
    }
  }

  async function handleDownload(r: ReportRecord) {
    setDownloadingId(r.id);
    try {
      const full = await reportService.getById(r.id);
      const blob = new Blob([JSON.stringify(full, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${r.title.replace(/[^\w-]+/g, "_")}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't download that report. Please try again.", { tone: "error" });
    } finally {
      setDownloadingId(null);
    }
  }

  if (!reports) return <LoadingState label="Loading reports" />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Reports</h1>
          <p className="text-[var(--w360-text-muted)] mt-1">A shareable summary of your health and wellness.</p>
        </div>
        <Button onClick={handleGenerate} disabled={generating}>{generating ? "Generating…" : "Generate report"}</Button>
      </div>

      {reports.length === 0 ? (
        <EmptyState title="No reports yet" description="Generate your first health report to see it here." />
      ) : (
        <div className="flex flex-col gap-3">
          {reports.map((r) => (
            <Card key={r.id}>
              <CardBody className="flex items-center justify-between pt-5 flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <FileText size={22} className="text-maroon-700 dark:text-maroon-200" />
                  <div>
                    <p className="font-medium">{r.title}</p>
                    <p className="text-xs text-[var(--w360-text-muted)]">{r.range} · Generated {new Date(r.generatedOn).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => handleDownload(r)} disabled={downloadingId === r.id}>
                    <Download size={14} /> {downloadingId === r.id ? "Downloading…" : "Download"}
                  </Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
