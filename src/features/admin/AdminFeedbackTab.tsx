import { useCallback, useEffect, useState } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { adminService, type Paged } from "@/services/adminService";
import type { FeedbackEntry } from "@/types";
import { Pager } from "./Pager";
import { when } from "./format";

export function AdminFeedbackTab() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paged<FeedbackEntry> | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    adminService.feedback(page).then(setData).catch(() => setFailed(true));
  }, [page]);
  useEffect(load, [load]);

  if (failed) return <ErrorState title="Couldn't load feedback" onRetry={load} />;
  if (!data) return <LoadingState />;
  if (data.items.length === 0) return <EmptyState title="No feedback yet" description="Ratings and comments from the Settings feedback tab appear here." />;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-[var(--w360-text-muted)]">Shown without names or emails. Use the account id to find the account in Users if a follow-up is needed.</p>
      <ul className="flex flex-col gap-3">
        {data.items.map((f) => (
          <li key={f.id}>
            <Card>
              <CardBody className="pt-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium" aria-label={`Rating ${f.rating} out of 5`}>{f.rating} / 5</p>
                  <p className="text-xs text-[var(--w360-text-muted)]">{when(f.createdAt)}</p>
                </div>
                {f.message ? <p className="mt-2 text-sm">{f.message}</p> : <p className="mt-2 text-sm text-[var(--w360-text-muted)]">No comment.</p>}
                <p className="mt-2 text-xs text-[var(--w360-text-muted)] break-all">Account {f.userId}</p>
              </CardBody>
            </Card>
          </li>
        ))}
      </ul>
      <Pager meta={data.meta} onPage={setPage} />
    </div>
  );
}
