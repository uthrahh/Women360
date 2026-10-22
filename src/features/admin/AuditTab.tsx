import { useCallback, useEffect, useState } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { adminService, type Paged } from "@/services/adminService";
import type { AuditEvent } from "@/types";
import { Pager } from "./Pager";
import { when } from "./format";

export function AuditTab() {
  const [action, setAction] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paged<AuditEvent> | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => {
      setQuery(action.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [action]);

  const load = useCallback(() => {
    setFailed(false);
    adminService.auditLog(page, query || undefined).then(setData).catch(() => setFailed(true));
  }, [page, query]);
  useEffect(load, [load]);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-[var(--w360-text-muted)] max-w-2xl">
        A record of sensitive actions: sign-ins, role changes, coach access and notes. It holds who did what and when, never health details, emails or passwords.
      </p>
      <div className="w-full sm:w-80">
        <Input label="Filter by action" value={action} onChange={(e) => setAction(e.target.value)} placeholder="e.g. coach.note_added" />
      </div>
      {failed ? (
        <ErrorState title="Couldn't load the audit log" onRetry={load} />
      ) : !data ? (
        <LoadingState />
      ) : data.items.length === 0 ? (
        <EmptyState title="Nothing recorded" description="No events match this filter yet." />
      ) : (
        <Card>
          <CardBody className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Audit log</caption>
              <thead>
                <tr className="text-left text-[var(--w360-text-muted)]">
                  <th scope="col" className="px-4 py-3 font-medium">When</th>
                  <th scope="col" className="px-4 py-3 font-medium">Action</th>
                  <th scope="col" className="px-4 py-3 font-medium">By</th>
                  <th scope="col" className="px-4 py-3 font-medium">About</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((e) => (
                  <tr key={e.id} className="border-t border-[var(--w360-border)]">
                    <td className="px-4 py-3 whitespace-nowrap text-[var(--w360-text-muted)]">{when(e.createdAt)}</td>
                    <td className="px-4 py-3 font-mono text-xs">{e.action}</td>
                    <td className="px-4 py-3 capitalize">{e.actorRole?.toLowerCase() ?? "system"}</td>
                    <td className="px-4 py-3 text-[var(--w360-text-muted)]">{e.targetType ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}
      {data && <Pager meta={data.meta} onPage={setPage} />}
    </div>
  );
}
