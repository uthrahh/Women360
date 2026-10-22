import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { useToast } from "@/components/ui/Toast";
import { adminService, type Paged } from "@/services/adminService";
import type { AdminUser } from "@/types";
import { Pager } from "./Pager";
import { day } from "./format";

const ROLE_FILTERS = [
  { value: "", label: "Everyone" },
  { value: "WOMAN", label: "Women" },
  { value: "COACH", label: "Coaches" },
  { value: "ADMIN", label: "Administrators" },
] as const;

export function UsersTab({ readOnly, selfId }: { readOnly: boolean; selfId: string }) {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<(typeof ROLE_FILTERS)[number]["value"]>("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paged<AdminUser> | null>(null);
  const [failed, setFailed] = useState(false);
  const [removing, setRemoving] = useState<AdminUser | null>(null);

  // Wait for a pause in typing before asking the server.
  useEffect(() => {
    const id = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [search]);

  const load = useCallback(() => {
    setFailed(false);
    adminService
      .users({ page, role: role || undefined, search: query || undefined })
      .then(setData)
      .catch(() => setFailed(true));
  }, [page, role, query]);
  useEffect(load, [load]);

  async function changeRole(user: AdminUser, next: "WOMAN" | "COACH") {
    try {
      await adminService.setRole(user.id, next);
      toast.show(`${user.name} is now ${next === "COACH" ? "a wellness coach" : "a woman account"}.`);
      load();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't change that role.", { tone: "error" });
      load();
    }
  }

  async function deactivate() {
    if (!removing) return;
    try {
      await adminService.deactivate(removing.id);
      toast.show(`${removing.name} was deactivated and signed out.`);
      setRemoving(null);
      load();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't deactivate that account.", { tone: "error" });
      setRemoving(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-72">
          <Input label="Search by name or email" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Start typing" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="role-filter" className="text-sm font-medium">Show</label>
          <select
            id="role-filter"
            value={role}
            onChange={(e) => {
              setRole(e.target.value as typeof role);
              setPage(1);
            }}
            className="px-3.5 py-3 rounded-xl border border-[var(--w360-border)] bg-[var(--w360-bg-raised)] text-sm"
          >
            {ROLE_FILTERS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
      </div>

      {failed ? (
        <ErrorState title="Couldn't load accounts" onRetry={load} />
      ) : !data ? (
        <LoadingState />
      ) : data.items.length === 0 ? (
        <EmptyState title="No accounts match" description="Try a different name, email or filter." />
      ) : (
        <Card>
          <CardBody className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Accounts</caption>
              <thead>
                <tr className="text-left text-[var(--w360-text-muted)]">
                  <th scope="col" className="px-4 py-3 font-medium">Name</th>
                  <th scope="col" className="px-4 py-3 font-medium">Email</th>
                  <th scope="col" className="px-4 py-3 font-medium">Role</th>
                  <th scope="col" className="px-4 py-3 font-medium">Joined</th>
                  <th scope="col" className="px-4 py-3 font-medium"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((u) => {
                  const isAdmin = u.role === "admin";
                  const locked = readOnly || isAdmin || u.id === selfId;
                  return (
                    <tr key={u.id} className="border-t border-[var(--w360-border)]">
                      <td className="px-4 py-3">
                        <span className="font-medium">{u.name}</span>
                        {u.isDemo && <Badge tone="accent" className="ml-2">Demo</Badge>}
                      </td>
                      <td className="px-4 py-3 text-[var(--w360-text-muted)] break-all">{u.email}</td>
                      <td className="px-4 py-3">
                        {isAdmin ? (
                          <Badge tone="neutral">Administrator</Badge>
                        ) : (
                          <select
                            aria-label={`Role for ${u.name}`}
                            value={u.role.toUpperCase()}
                            disabled={locked}
                            onChange={(e) => changeRole(u, e.target.value as "WOMAN" | "COACH")}
                            className="px-2.5 py-1.5 rounded-lg border border-[var(--w360-border)] bg-[var(--w360-bg-raised)] disabled:opacity-60"
                          >
                            <option value="WOMAN">Woman</option>
                            <option value="COACH">Wellness coach</option>
                          </select>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-[var(--w360-text-muted)]">{day(u.createdAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" variant="ghost" disabled={locked} onClick={() => setRemoving(u)}>Deactivate</Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}
      {data && <Pager meta={data.meta} onPage={setPage} />}
      {readOnly && <p className="text-xs text-[var(--w360-text-muted)]">This account is read-only, so roles and accounts cannot be changed.</p>}

      <ConfirmDialog
        open={removing !== null}
        title="Deactivate this account?"
        description={removing ? `${removing.name} (${removing.email}) will be signed out and will no longer be able to log in.` : undefined}
        confirmLabel="Deactivate"
        onConfirm={deactivate}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}
