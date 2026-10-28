import { useState } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Hint } from "@/components/ui/Hint";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { conditionService } from "@/services/conditionService";
import { localDateISO } from "@/services/mappers";
import { buildDoctorSummary } from "@/lib/doctorSummary";
import type { ConditionCode, ConditionList, CycleSummary } from "@/types";

/**
 * Where she tells Women360 about a condition she has. It never guesses one for her. It changes
 * only what the app suggests she notes each day and what it puts in a summary for her doctor.
 */
export function ConditionsCard({ list, cycle, onChanged }: { list: ConditionList | null; cycle: CycleSummary; onChanged: (next: ConditionList) => void }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [chosen, setChosen] = useState<ConditionCode[]>([]);
  const [busy, setBusy] = useState(false);

  if (!list) return null;
  const declared = list.conditions.filter((c) => c.declared);

  function open() {
    setChosen(declared.map((c) => c.code));
    setEditing(true);
  }

  async function save() {
    setBusy(true);
    try {
      onChanged(await conditionService.setDeclared(chosen));
      setEditing(false);
      toast.show("Saved");
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't save that. Please try again.", { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function copySummary() {
    try {
      const { signals } = await conditionService.signals();
      const text = buildDoctorSummary({
        day: localDateISO(),
        conditions: list!.conditions,
        cycleLengths: cycle.lastCycleLengths,
        periodLength: cycle.periodLength,
        periodLengthLogged: cycle.loggedPeriodLength !== null,
        signals,
      });
      await navigator.clipboard.writeText(text);
      toast.show("Copied. Paste it into a message or bring it to your appointment.");
    } catch {
      toast.show("Couldn't copy that. Please try again.", { tone: "error" });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Hint id="conditions-intro" className="text-sm text-[var(--w360-text-muted)]">
        Tell Women360 about a condition you have, such as PCOS or endometriosis. It only changes what we suggest you note and bring to your doctor. It never works out a condition for you.
      </Hint>

      {declared.length === 0 ? (
        <Card>
          <CardBody className="pt-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm senior:text-base">You haven't added a condition.</p>
            <Button variant="secondary" onClick={open}>Add a condition</Button>
          </CardBody>
        </Card>
      ) : (
        <>
          <div className="flex flex-col divide-y divide-[var(--w360-border)] rounded-xl border border-[var(--w360-border)]">
            {declared.map((c) => (
              <details key={c.code} className="px-4" open={declared.length === 1}>
                <summary className="cursor-pointer py-3 text-sm senior:text-lg font-medium">{c.label}</summary>
                <div className="pb-4 flex flex-col gap-3 text-sm senior:text-base">
                  <p>{c.about}</p>
                  <div>
                    <p className="font-medium">Worth noting when you log a day</p>
                    <p className="text-[var(--w360-text-muted)]">{c.trackSymptoms.join(", ")}.</p>
                    <Hint id={`cond-track-${c.code}`} className="text-xs text-[var(--w360-text-muted)] mt-1">These now appear in the symptom list when you log a day.</Hint>
                  </div>
                  <p className="text-[var(--w360-text-muted)]">{c.note}</p>
                  {c.sources.length > 0 && (
                    <p className="text-xs senior:text-base text-[var(--w360-text-muted)]">
                      Source:{" "}
                      {c.sources.map((s, i) => (
                        <span key={s.url}>
                          {i > 0 && "; "}
                          <a href={s.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">{s.label}</a>
                        </span>
                      ))}
                      . {list.review.note}
                    </p>
                  )}
                </div>
              </details>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={open}>Change my conditions</Button>
            <Button variant="secondary" size="sm" onClick={copySummary}>Copy a summary for my doctor</Button>
          </div>
        </>
      )}

      <Modal open={editing} onClose={() => setEditing(false)} title="My conditions" size="md">
        <div className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">Conditions</legend>
            {list.conditions.map((c) => {
              const on = chosen.includes(c.code);
              return (
                <label key={c.code} className="flex items-start gap-3 rounded-xl border border-[var(--w360-border)] px-3.5 py-3 cursor-pointer">
                  <input type="checkbox" className="mt-1 w-4 h-4 accent-[#6B1D30]" checked={on} onChange={() => setChosen((cur) => (on ? cur.filter((x) => x !== c.code) : [...cur, c.code]))} />
                  <span>
                    <span className="block text-sm senior:text-lg font-medium">{c.label}</span>
                    <span className="block text-xs senior:text-base text-[var(--w360-text-muted)]">{c.about}</span>
                  </span>
                </label>
              );
            })}
          </fieldset>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
            <Button disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
