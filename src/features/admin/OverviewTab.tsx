import { useEffect, useState } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { adminService } from "@/services/adminService";
import type { AdminOverview } from "@/types";

function Stat({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <Card>
      <CardBody className="pt-5">
        <p className="text-sm text-[var(--w360-text-muted)]">{label}</p>
        <p className="font-display text-3xl font-semibold tabular-nums mt-1">{value}</p>
        {note && <p className="text-xs text-[var(--w360-text-muted)] mt-1">{note}</p>}
      </CardBody>
    </Card>
  );
}

export function OverviewTab() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [failed, setFailed] = useState(false);
  const load = () => {
    setFailed(false);
    adminService.overview().then(setData).catch(() => setFailed(true));
  };
  useEffect(load, []);

  if (failed) return <ErrorState title="Couldn't load the overview" onRetry={load} />;
  if (!data) return <LoadingState />;

  return (
    <div className="flex flex-col gap-5">
      <section aria-label="Accounts" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Women" value={data.users.women} />
        <Stat label="Wellness coaches" value={data.users.coaches} />
        <Stat label="Administrators" value={data.users.admins} />
        <Stat label="Joined this week" value={data.users.joinedThisWeek} />
      </section>
      <section aria-label="Activity" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Feedback received" value={data.feedbackCount} />
        <Stat label="Learn articles" value={data.articles} />
        <Stat label="Audit events this week" value={data.auditEventsThisWeek} />
      </section>
      <p className="text-xs text-[var(--w360-text-muted)] max-w-xl">
        Administrator accounts are created only by an operator with server access. They cannot be created, promoted or removed from this screen.
      </p>
    </div>
  );
}
