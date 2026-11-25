import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Search } from "lucide-react";
import { clientService } from "@/services/clientService";
import type { ClientListItem } from "@/types/clients";
import { shortDate } from "@/types/clients";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { localDateISO } from "@/services/mappers";
import { NewClientDialog } from "./NewClientDialog";
import { ClientRecordView } from "./ClientRecordView";

/** A coach's clients: who is due for a follow-up, a search, and the record of the one selected. Adding a client is one button. */
export function ClientsTab() {
  const [list, setList] = useState<ClientListItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback((select?: string) => {
    setFailed(false);
    clientService
      .list()
      .then((l) => {
        setList(l);
        setSelected((s) => select ?? (s && l.some((c) => c.id === s) ? s : null));
      })
      .catch(() => setFailed(true));
  }, []);
  useEffect(() => load(), [load]);

  const today = localDateISO();
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const items = (list ?? []).filter((c) => !q || c.name.toLowerCase().includes(q));
    // Follow-ups due soonest first, then everyone else by name.
    return items.sort((a, b) => (a.nextFollowUp ?? "9999").localeCompare(b.nextFollowUp ?? "9999") || a.name.localeCompare(b.name));
  }, [list, query]);

  // With nothing chosen yet, the first in the list (the soonest follow-up) is open.
  const active = selected ?? shown[0]?.id ?? null;

  if (failed) return <ErrorState title="Couldn't load your clients" onRetry={() => load()} />;
  if (!list) return <LoadingState variant="rows" />;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--w360-text-muted)] measure">
          The people you look after. You see the parts of each record that match your specialities.
        </p>
        <Button onClick={() => setAdding(true)}>Add a client</Button>
      </div>

      {list.length === 0 ? (
        <EmptyState title="No clients yet" description="Add a client during her first consultation. She can start using the app herself later, with a link you send her." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[18rem_minmax(0,1fr)] gap-6 items-start">
          <nav aria-label="Clients" className="flex flex-col gap-3">
            {list.length > 6 && (
              <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--w360-border)] bg-[var(--w360-bg-raised)]">
                <Search size={15} aria-hidden className="text-[var(--w360-text-muted)]" />
                <span className="sr-only">Search clients</span>
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name" className="bg-transparent outline-none text-sm flex-1 min-w-0" />
              </label>
            )}
            <ul className="flex flex-col gap-2">
              {shown.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(c.id)}
                    aria-current={active === c.id ? "true" : undefined}
                    className={clsx(
                      "w-full text-left rounded-2xl border px-4 py-3 transition-colors",
                      active === c.id ? "border-maroon-700 bg-[var(--w360-tint)] dark:border-maroon-300" : "border-[var(--w360-border)] hover:border-maroon-400"
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-medium truncate">{c.name}</span>
                      {c.nextFollowUp && c.nextFollowUp <= today && <Badge tone="accent">Due today</Badge>}
                    </span>
                    <span className="block text-xs text-[var(--w360-text-muted)] tabular-nums">
                      {[c.age !== null ? `${c.age} years` : null, c.gender, c.nextFollowUp ? `Follow-up ${shortDate(c.nextFollowUp)}` : null].filter(Boolean).join(" · ")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          {active && <ClientRecordView key={active} clientId={active} onChanged={() => load()} onRemoved={() => load()} />}
        </div>
      )}

      <NewClientDialog open={adding} onClose={() => setAdding(false)} onCreated={(id) => load(id)} />
    </div>
  );
}
