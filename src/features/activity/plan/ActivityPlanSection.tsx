import { useCallback, useEffect, useState } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { planService } from "@/services/planService";
import { PlanWizard } from "./PlanWizard";
import { ActivePlanCard } from "./ActivePlanCard";
import type { ActivePlan } from "@/types";

/**
 * Either her active plan, or a quiet invitation to ask for one. A plan is only ever built
 * when she asks, from her own logs; nothing here is shown as an alert or a nudge.
 */
export function ActivityPlanSection({ onLogged }: { onLogged: () => void }) {
  const [plan, setPlan] = useState<ActivePlan | null | undefined>(undefined);
  const [open, setOpen] = useState(false);

  const load = useCallback(() => {
    planService.active().then(setPlan).catch(() => setPlan(null));
  }, []);
  useEffect(load, [load]);

  return (
    <>
      {plan === undefined ? null : plan ? (
        <ActivePlanCard
          active={plan}
          onChanged={() => {
            load();
            onLogged();
          }}
          onEnded={() => setPlan(null)}
        />
      ) : (
        <Card>
          <CardBody className="pt-5 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-display text-lg senior:text-2xl font-semibold">A plan for a goal</h2>
              <p className="text-sm senior:text-base text-[var(--w360-text-muted)]">
                Pick a goal and get a week-by-week plan built from your own activity, your time and your age, with an honest view of how realistic it is.
              </p>
            </div>
            <Button variant="secondary" onClick={() => setOpen(true)}>Build my plan</Button>
          </CardBody>
        </Card>
      )}
      <PlanWizard open={open} onClose={() => setOpen(false)} onStarted={setPlan} />
    </>
  );
}
