import { useEffect, useState, type FormEvent } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useToast } from "@/components/ui/Toast";
import { userService } from "@/services/userService";
import { localDateISO } from "@/services/mappers";
import type { ContraceptionMethod, PregnancyStatus } from "@/types";
import { Hint } from "@/components/ui/Hint";

const CONTRACEPTION: { value: ContraceptionMethod; label: string }[] = [
  { value: "NONE", label: "None" },
  { value: "PILL", label: "The pill" },
  { value: "IUD_COPPER", label: "Copper IUD" },
  { value: "IUD_HORMONAL", label: "Hormonal IUD" },
  { value: "IMPLANT", label: "Implant" },
  { value: "INJECTION", label: "Injection" },
  { value: "CONDOM", label: "Condoms" },
  { value: "NATURAL_METHODS", label: "Natural methods" },
  { value: "STERILISATION", label: "Sterilisation" },
  { value: "OTHER", label: "Other" },
];

const PREGNANCY: { value: PregnancyStatus; label: string }[] = [
  { value: "NOT_PREGNANT", label: "Not pregnant" },
  { value: "TRYING_TO_CONCEIVE", label: "Trying to conceive" },
  { value: "PREGNANT", label: "Pregnant" },
  { value: "POSTPARTUM", label: "Recently gave birth" },
];

const selectClass =
  "px-3.5 py-3 rounded-xl border border-[var(--w360-border)] bg-[var(--w360-bg-raised)] text-[var(--w360-text)] text-sm senior:text-lg";

/**
 * What she chooses to record about contraception and pregnancy. It is for her
 * own records: nothing here is used to predict fertility or to advise her.
 */
export function ReproductiveHealthTab() {
  const toast = useToast();
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [contraception, setContraception] = useState("");
  const [pregnancy, setPregnancy] = useState("");
  const [due, setDue] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => {
    setFailed(false);
    userService
      .getReproductiveHealth()
      .then((r) => {
        setContraception(r?.contraception ?? "");
        setPregnancy(r?.pregnancyStatus ?? "");
        setDue(r?.expectedDueDate ? r.expectedDueDate.slice(0, 10) : "");
        setNotes(r?.notes ?? "");
        setLoaded(true);
      })
      .catch(() => setFailed(true));
  };
  useEffect(load, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await userService.saveReproductiveHealth({
        contraception: (contraception || null) as ContraceptionMethod | null,
        pregnancyStatus: (pregnancy || null) as PregnancyStatus | null,
        expectedDueDate: pregnancy === "PREGNANT" && due ? due : null,
        notes: notes.trim() || null,
      });
      toast.show("Saved");
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't save that. Please try again.", { tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  if (failed) return <ErrorState title="Couldn't load this" onRetry={load} />;
  if (!loaded) return <LoadingState />;

  return (
    <Card>
      <CardBody className="pt-5">
        <form onSubmit={save} className="flex flex-col gap-4 max-w-lg">
          <Hint id="repro-intro" className="text-sm text-[var(--w360-text-muted)]">
            For your own records. Women360 does not use this to predict fertility or to give medical advice, and you can leave anything blank.
          </Hint>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="rh-contraception" className="text-sm font-medium">Contraception</label>
            <select id="rh-contraception" value={contraception} onChange={(e) => setContraception(e.target.value)} className={selectClass}>
              <option value="">Prefer not to say</option>
              {CONTRACEPTION.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="rh-pregnancy" className="text-sm font-medium">Pregnancy</label>
            <select id="rh-pregnancy" value={pregnancy} onChange={(e) => setPregnancy(e.target.value)} className={selectClass}>
              <option value="">Prefer not to say</option>
              {PREGNANCY.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          {pregnancy === "PREGNANT" && (
            <Input label="Expected due date" type="date" value={due} min={localDateISO()} onChange={(e) => setDue(e.target.value)} />
          )}
          <Input label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
          <div>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
