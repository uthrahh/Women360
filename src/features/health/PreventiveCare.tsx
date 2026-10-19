import { useEffect, useState } from "react";
import { CalendarCheck, ChevronDown, ExternalLink } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/Toast";
import { useApp } from "@/context/AppContext";
import { screeningService } from "@/services/screeningService";
import { userService } from "@/services/userService";
import { localDateISO } from "@/services/mappers";
import type { ScreeningItem, ScreeningPlan, ScreeningStatus } from "@/types";

const BADGE: Record<ScreeningStatus, { label: string; tone: "neutral" | "accent" | "success" | "warning" }> = {
  needs_dob: { label: "Needs your birth date", tone: "neutral" },
  later: { label: "Not yet", tone: "neutral" },
  beyond: { label: "Ask your doctor", tone: "neutral" },
  not_recorded: { label: "Not recorded yet", tone: "accent" },
  due: { label: "Due now", tone: "warning" },
  soon: { label: "Due soon", tone: "accent" },
  up_to_date: { label: "Up to date", tone: "success" },
};

// What needs her attention comes first; what doesn't yet apply goes last.
const ORDER: ScreeningStatus[] = ["due", "not_recorded", "soon", "up_to_date", "beyond", "later", "needs_dob"];

const fmt = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

function every(months: number): string {
  if (months % 12 === 0) {
    const y = months / 12;
    return y === 1 ? "once a year" : `once every ${y} years`;
  }
  return `every ${months} months`;
}

function headline(i: ScreeningItem): string {
  switch (i.status) {
    case "up_to_date":
    case "soon":
    case "due":
      return `Last done ${fmt(i.lastDoneOn!)}. Next ${i.status === "due" ? "was due" : "due"} ${fmt(i.nextDueOn!)}.`;
    case "not_recorded":
      return `Suggested ${every(i.intervalMonths)}. Tell us if you've had one.`;
    case "later":
      return `Suggested from age ${i.startAge}${i.startsInYears ? `, in about ${i.startsInYears} year${i.startsInYears === 1 ? "" : "s"}` : ""}.`;
    case "beyond":
      return `The national programme covers ages ${i.startAge} to ${i.endAge}. Ask your doctor what suits you now.`;
    default:
      return "Add your date of birth to see what applies to you.";
  }
}

function Item({ item, busy, onDone, onUndo }: { item: ScreeningItem; busy: boolean; onDone: (day: string) => void; onUndo: () => void }) {
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [day, setDay] = useState("");
  const actionable = item.status !== "needs_dob" && item.status !== "later";
  const panel = `screening-${item.id}`;

  return (
    <li>
      <Card>
        <CardBody className="pt-5 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-medium senior:text-xl">{item.title}</h3>
              <p className="text-sm text-[var(--w360-text-muted)] mt-0.5">{headline(item)}</p>
            </div>
            <Badge tone={BADGE[item.status].tone} className="shrink-0">{BADGE[item.status].label}</Badge>
          </div>

          {actionable && (
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" disabled={busy} onClick={() => onDone(localDateISO())}>
                <CalendarCheck size={15} /> Done today
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} aria-expanded={picking} onClick={() => setPicking((p) => !p)}>
                Done on another day
              </Button>
              {item.lastRecordId && (
                <Button size="sm" variant="ghost" disabled={busy} onClick={onUndo}>Undo last</Button>
              )}
            </div>
          )}

          {picking && (
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!day) return;
                onDone(day);
                setPicking(false);
                setDay("");
              }}
            >
              <Input label="Date" type="date" value={day} max={localDateISO()} onChange={(e) => setDay(e.target.value)} required />
              <Button size="sm" type="submit" disabled={busy || !day}>Save</Button>
            </form>
          )}

          <button
            type="button"
            className="self-start inline-flex items-center gap-1 text-sm text-[var(--w360-accent)] hover:underline rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--w360-focus)]"
            aria-expanded={open}
            aria-controls={panel}
            onClick={() => setOpen((o) => !o)}
          >
            Why, how, and where this comes from
            <ChevronDown size={14} className={open ? "rotate-180" : ""} aria-hidden />
          </button>

          {open && (
            <div id={panel} className="text-sm flex flex-col gap-2 border-t border-[var(--w360-border)] pt-3">
              <p>{item.why}</p>
              <p><span className="font-medium">What happens:</span> {item.method}.</p>
              {item.note && <p>{item.note}</p>}
              {item.caveats.length > 0 && (
                <ul className="list-disc pl-5 text-[var(--w360-text-muted)]">
                  {item.caveats.map((c) => <li key={c}>{c}</li>)}
                </ul>
              )}
              <ul className="text-xs text-[var(--w360-text-muted)] flex flex-col gap-1">
                {item.sources.map((s) => (
                  <li key={s.label}>
                    {s.url ? (
                      <a href={s.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 underline">
                        {s.label} <ExternalLink size={11} aria-hidden />
                      </a>
                    ) : s.label}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardBody>
      </Card>
    </li>
  );
}

// The check-ups the national and WHO guidance suggest for her age, what she has
// already had, and when each is next due. One tap records one. The advice and
// its sources come from the server; nothing here is a fixed claim.
export function PreventiveCare() {
  const { auth } = useApp();
  const toast = useToast();
  const [plan, setPlan] = useState<ScreeningPlan | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dob, setDob] = useState("");

  const load = () => {
    setFailed(false);
    screeningService.list().then(setPlan).catch(() => setFailed(true));
  };
  useEffect(load, []);

  async function act(run: () => Promise<ScreeningPlan>, success: string) {
    setBusy(true);
    try {
      setPlan(await run());
      toast.show(success);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't save that. Please try again.", { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function saveDob() {
    if (!dob) return;
    setBusy(true);
    try {
      auth.refreshUser(await userService.updateProfile({ dateOfBirth: dob }));
      setPlan(await screeningService.list());
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't save your birth date.", { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  if (failed) return <ErrorState title="Couldn't load your check-ups" onRetry={load} />;
  if (!plan) return <LoadingState />;

  const items = [...plan.items].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status));

  return (
    <div className="flex flex-col gap-4">
      <Banner tone="warning" title={plan.reviewStatus}>
        Guidance last checked {fmt(plan.reviewedOn)}. Treat the schedule below as a starting point and confirm it with your doctor.
      </Banner>

      <p className="text-sm text-[var(--w360-text-muted)]">
        Regular check-ups catch problems early, often before you feel anything. These follow guidance used in {plan.region}. Tap once when you've had one and we'll work out when it's next due.
      </p>

      {!plan.hasDateOfBirth && (
        <Card tone="tint">
          <CardBody className="pt-5 flex flex-wrap items-end gap-3">
            <Input label="Your date of birth" type="date" value={dob} max={localDateISO()} onChange={(e) => setDob(e.target.value)} hint="Used only to work out which check-ups apply at your age." />
            <Button type="button" disabled={busy || !dob} onClick={saveDob}>Save</Button>
          </CardBody>
        </Card>
      )}

      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <Item
            key={item.id}
            item={item}
            busy={busy}
            onDone={(d) => act(() => screeningService.record(item.id, d), `${item.title} recorded.`)}
            onUndo={() => act(() => screeningService.undo(item.id, item.lastRecordId!), "Removed the last record.")}
          />
        ))}
      </ul>

      <Banner tone="info">{plan.disclaimer} This is reference information, not a diagnosis.</Banner>
    </div>
  );
}
