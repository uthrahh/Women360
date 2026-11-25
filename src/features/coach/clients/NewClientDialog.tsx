import { useEffect, useState } from "react";
import { clientService } from "@/services/clientService";
import { GENDERS, MARITAL } from "@/types/clients";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { TextArea } from "@/components/ui/TextArea";
import { DateWheel } from "@/components/ui/DateWheel";
import { ChoiceRow } from "@/components/ui/ChoiceRow";
import { SegmentedChoice } from "@/components/ui/SegmentedChoice";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { localDateISO } from "@/services/mappers";

const ageOf = (dob: string) => {
  const [y, m, d] = dob.split("-").map(Number);
  const [ty, tm, td] = localDateISO().split("-").map(Number);
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
};

/**
 * Basic details, taken at the first consultation. Only the name and date of birth are needed; the rest can be added later. The coach
 * confirms the client agreed to her details being recorded (and, under 18, that a parent or guardian agreed).
 */
export function NewClientDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const blank = { name: "", dob: "", gender: null as string | null, email: "", phone: "", address: "", occupation: "", marital: null as string | null, cycle: "yes" as "yes" | "no", consent: false, guardian: false };
  const [f, setF] = useState(blank);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  useEffect(() => {
    if (open) {
      setF(blank);
      setError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const set = <K extends keyof typeof blank>(k: K, v: (typeof blank)[K]) => setF((x) => ({ ...x, [k]: v }));
  const minor = f.dob !== "" && ageOf(f.dob) < 18;

  async function save() {
    setError("");
    if (!f.name.trim()) return setError("Enter her name.");
    if (!f.dob) return setError("Choose her date of birth.");
    if (ageOf(f.dob) < 13) return setError("Clients are recorded from age 13.");
    if (minor && !f.guardian) return setError("For someone under 18, confirm that a parent or guardian agreed.");
    if (!f.consent) return setError("Confirm that she agreed to her details being recorded.");
    setBusy(true);
    try {
      const c = await clientService.create({
        name: f.name.trim(), dateOfBirth: f.dob, gender: f.gender, email: f.email.trim() || null, phone: f.phone.trim() || null, address: f.address.trim() || null,
        occupation: f.occupation.trim() || null, maritalStatus: f.marital, tracksCycle: f.cycle === "yes", consent: true, guardianConsent: minor ? true : undefined,
      });
      toast.show(`${f.name.trim()} added`);
      onCreated(c.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add her. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add a client">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Input label="Name" value={f.name} onChange={(e) => set("name", e.target.value)} maxLength={80} autoComplete="off" />
        <DateWheel label="Date of birth" value={f.dob} onChange={(v) => set("dob", v)} />
        <ChoiceRow label="Gender" choices={GENDERS.map((g) => ({ value: g, label: g }))} value={f.gender} onChange={(v) => setF((x) => ({ ...x, gender: v, cycle: v === "Man" ? "no" : v === "Woman" ? "yes" : x.cycle }))} />
        <SegmentedChoice<"yes" | "no">
          label="Menstrual history and cycle tracker"
          options={[{ value: "yes", label: "Applies" }, { value: "no", label: "Doesn't apply" }]}
          value={f.cycle}
          onChange={(v) => set("cycle", v)}
        />
        <Input label="Phone (optional)" type="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} maxLength={30} autoComplete="off" />
        <Input label="Email (optional)" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} maxLength={200} autoComplete="off" hint="Used as her sign-in if she later uses the app." />
        <details className="text-sm">
          <summary className="cursor-pointer font-medium">More details (optional)</summary>
          <div className="flex flex-col gap-4 mt-3">
            <TextArea label="Address" optional rows={2} value={f.address} onChange={(e) => set("address", e.target.value)} maxLength={300} />
            <Input label="Occupation (optional)" value={f.occupation} onChange={(e) => set("occupation", e.target.value)} maxLength={80} />
            <ChoiceRow label="Marital status" choices={MARITAL.map((m) => ({ value: m, label: m }))} value={f.marital} onChange={(v) => set("marital", v)} />
          </div>
        </details>
        {minor && (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={f.guardian} onChange={(e) => set("guardian", e.target.checked)} className="mt-1" />
            <span>She is under 18, and a parent or legal guardian agreed to her details being recorded.</span>
          </label>
        )}
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={f.consent} onChange={(e) => set("consent", e.target.checked)} className="mt-1" />
          <span>She agreed to her details being recorded in Women360 and seen by her coaches, each for their own speciality.</span>
        </label>
        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <Button type="submit" disabled={busy}>{busy ? "Adding…" : "Add client"}</Button>
      </form>
    </Modal>
  );
}
