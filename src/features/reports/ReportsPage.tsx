import { useEffect, useState } from "react";
import { reportService } from "@/services/reportService";
import type { ReportRecord } from "@/types";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LoadingState, EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/Toast";
import { FileText, Download, Share2 } from "lucide-react";

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportRecord[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const toast = useToast();

  useEffect(() => {
    reportService.list().then(setReports);
  }, []);

  async function handleGenerate() {
    setGenerating(true);
    const r = await reportService.generate("Health Report", "Last 30 days");
    setReports((prev) => [r, ...(prev ?? [])]);
    setGenerating(false);
    toast.show("Report generated");
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
                  <Button variant="secondary" size="sm" onClick={() => toast.show("Downloaded (mock)")}> <Download size={14} /> Download</Button>
                  <Button variant="ghost" size="sm" onClick={() => toast.show("Shared with coach")}> <Share2 size={14} /> Share</Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
