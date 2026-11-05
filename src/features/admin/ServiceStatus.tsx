import { useEffect, useState } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { adminService } from "@/services/adminService";
import type { SystemStatus } from "@/types";

import { statusRows, type Level } from "./statusRows";

const WORDS: Record<Level, string> = { ok: "Working", attention: "Needs attention", info: "Note" };
const STYLE: Record<Level, string> = {
  ok: "text-emerald-800 dark:text-emerald-300",
  attention: "text-amber-800 dark:text-amber-300",
  info: "text-[var(--w360-text-muted)]",
};

/** What the running service says about itself, so none of this needs a dashboard to check. */
export function ServiceStatus() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    adminService.system().then(setStatus).catch(() => setFailed(true));
  }, []);

  return (
    <Card>
      <CardBody className="pt-5">
        <h2 className="font-medium">Service status</h2>
        {failed ? (
          <p className="mt-2 text-sm text-[var(--w360-text-muted)]">Couldn't load the status. If the rest of this page loaded, reload to try again.</p>
        ) : !status ? (
          <p className="mt-2 text-sm text-[var(--w360-text-muted)]">Checking…</p>
        ) : (
          <dl className="mt-2 divide-y divide-[var(--w360-border)]">
            {statusRows(status).map((r) => (
              <div key={r.label} className="py-2.5 grid sm:grid-cols-[14rem_1fr] gap-x-4 gap-y-0.5">
                <dt className="text-sm font-medium">{r.label}</dt>
                <dd className="text-sm">
                  <span className={`font-medium ${STYLE[r.level]}`}>{WORDS[r.level]}.</span>{" "}
                  <span className="text-[var(--w360-text-muted)]">{r.text}</span>
                </dd>
              </div>
            ))}
          </dl>
        )}
      </CardBody>
    </Card>
  );
}
