import { Button } from "@/components/ui/Button";
import type { PageMeta } from "@/services/apiClient";

/** Previous / next for a paged list, with where you are. Renders nothing for a single page. */
export function Pager({ meta, onPage }: { meta: PageMeta; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(meta.total / meta.pageSize));
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pages" className="flex items-center justify-between gap-3 pt-3">
      <p className="text-sm text-[var(--w360-text-muted)]">
        Page {meta.page} of {pages} · {meta.total} in total
      </p>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>Previous</Button>
        <Button size="sm" variant="secondary" disabled={meta.page >= pages} onClick={() => onPage(meta.page + 1)}>Next</Button>
      </div>
    </nav>
  );
}
