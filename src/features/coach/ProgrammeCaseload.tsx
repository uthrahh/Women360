import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { coachProgrammeService } from "@/services/programmeService";
import type { CaseloadItem } from "@/types/programme";
import { STATUS_LABEL } from "@/types/programme";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { Badge } from "@/components/ui/Badge";
import { EnrolmentDetail } from "./EnrolmentDetail";

/** Everyone an administrator assigned to this coach, with who needs a reply first; selecting one opens her programme. */
export function ProgrammeCaseload() {
  const [list, setList] = useState<CaseloadItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(() => {
    setFailed(false);
    coachProgrammeService
      .caseload()
      .then((l) => {
        setList(l);
        setSelected((s) => (s && l.some((x) => x.id === s) ? s : l[0]?.id ?? null));
      })
      .catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);

  if (failed) return <ErrorState title="Couldn't load your programme participants" onRetry={load} />;
  if (!list) return <LoadingState variant="rows" />;
  if (list.length === 0) {
    return <EmptyState title="No one in a programme yet" description="When an administrator assigns you someone who joined a programme, she appears here." />;
  }

  // Help requests first, then whoever is waiting for a plan or a final review.
  const waiting = (c: CaseloadItem) => (c.helpOpen > 0 ? 0 : c.status === "PLANNING" || c.status === "FINAL_REVIEW" ? 1 : 2);
  const sorted = [...list].sort((a, b) => waiting(a) - waiting(b));

  return (
    <div className="grid lg:grid-cols-[18rem_minmax(0,1fr)] gap-6 items-start">
      <nav aria-label="Programme participants">
        <ul className="flex flex-col gap-2">
          {sorted.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setSelected(c.id)}
                aria-current={selected === c.id ? "true" : undefined}
                className={clsx(
                  "w-full text-left rounded-2xl border px-4 py-3 transition-colors",
                  selected === c.id ? "border-maroon-700 bg-[var(--w360-tint)] dark:border-maroon-300" : "border-[var(--w360-border)] hover:border-maroon-400"
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">{c.name}</span>
                  {c.helpOpen > 0 && <Badge tone="accent">{c.helpOpen} to answer</Badge>}
                </span>
                <span className="block text-xs text-[var(--w360-text-muted)] tabular-nums">
                  {STATUS_LABEL[c.status]}
                  {c.day !== null && c.status === "ACTIVE" && `, day ${c.day} of ${c.durationDays}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
      {selected && <EnrolmentDetail key={selected} enrolmentId={selected} onChanged={load} />}
    </div>
  );
}
