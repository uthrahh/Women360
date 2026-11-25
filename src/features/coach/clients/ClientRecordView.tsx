import { useCallback, useEffect, useState } from "react";
import { Copy } from "lucide-react";
import { clientService } from "@/services/clientService";
import type { ClientRecord, IntakeForm, IntakeSection, Speciality } from "@/types/clients";
import { GENDERS, MARITAL, SPECIALITY_LABEL, shortDate } from "@/types/clients";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { TextArea } from "@/components/ui/TextArea";
import { NumberField } from "@/components/ui/NumberField";
import { ChoiceRow } from "@/components/ui/ChoiceRow";
import { SegmentedChoice } from "@/components/ui/SegmentedChoice";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useToast } from "@/components/ui/Toast";
import { localDateISO } from "@/services/mappers";
import { IntakeSectionCard } from "./IntakeSectionCard";
import { ClientLogs } from "./ClientLogs";

const errText = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);
const num = (v: string) => (v === "" ? null : Number(v));

/** One client's record, cut by the server to this coach's specialities: details, coaches, app access, assessment, measurements, consultations. */
export function ClientRecordView({ clientId, onChanged, onRemoved }: { clientId: string; onChanged: () => void; onRemoved: () => void }) {
  const [r, setR] = useState<ClientRecord | null>(null);
  const [form, setForm] = useState<IntakeForm | null>(null);
  const [failed, setFailed] = useState(false);
  const [dialog, setDialog] = useState<"basic" | "measure" | "consult" | "coach" | "remove" | "leave" | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const toast = useToast();

  const load = useCallback(() => {
    setFailed(false);
    Promise.all([clientService.record(clientId), clientService.form()])
      .then(([rec, f]) => {
        setR(rec);
        setForm(f);
      })
      .catch(() => setFailed(true));
  }, [clientId]);
  useEffect(load, [load]);

  if (failed) return <ErrorState title="Couldn't load this record" onRetry={load} />;
  if (!r || !form) return <LoadingState variant="rows" />;

  const refresh = () => {
    load();
    onChanged();
  };
  const b = r.basic;
  const intakeSections = r.sections.filter((s): s is IntakeSection => s !== "measurements");

  return (
    <div className="flex flex-col gap-6 min-w-0">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="font-display text-2xl font-semibold">{b.name}</h2>
            <p className="text-sm text-[var(--w360-text-muted)] tabular-nums">
              {[b.age !== null ? `${b.age} years` : null, b.gender, b.occupation, b.maritalStatus].filter(Boolean).join(" · ")}
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => setDialog("basic")}>Edit details</Button>
        </div>
        {(b.phone || b.email || b.address) && (
          <p className="text-sm flex flex-wrap gap-x-4 gap-y-1">
            {b.phone && <a href={`tel:${b.phone.replace(/\s+/g, "")}`} className="text-maroon-700 dark:text-maroon-300 tabular-nums">{b.phone}</a>}
            {b.email && <a href={`mailto:${b.email}`} className="text-maroon-700 dark:text-maroon-300">{b.email}</a>}
            {b.address && <span className="text-[var(--w360-text-muted)]">{b.address}</span>}
          </p>
        )}
        <p className="text-xs text-[var(--w360-text-muted)]">You see the sections for {r.mySpecialities.map((s) => SPECIALITY_LABEL[s].toLowerCase()).join(" and ")}.</p>
      </header>

      <section aria-labelledby="cr-coaches" className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h3 id="cr-coaches" className="font-display text-lg font-semibold">Her coaches</h3>
          <Button size="sm" variant="secondary" onClick={() => setDialog("coach")}>Add a coach</Button>
        </div>
        <ul className="flex flex-col gap-1 text-sm">
          {r.coaches.map((c) => (
            <li key={c.id}>
              <span className="font-medium">{c.name}</span> <span className="text-[var(--w360-text-muted)]">· {c.specialities.map((s) => SPECIALITY_LABEL[s]).join(", ")}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="cr-app" className="flex flex-col gap-2">
        <h3 id="cr-app" className="font-display text-lg font-semibold">Using the app</h3>
        {r.app.usesApp ? (
          <p className="text-sm">She uses Women360 herself.</p>
        ) : r.app.canInvite ? (
          <>
            <p className="text-sm text-[var(--w360-text-muted)] measure">
              Send her a one-time link to set a password and log her days herself. It works once, for 7 days. Anyone with the link can claim the record, so send it only to her.
            </p>
            {link ? (
              <div className="flex flex-wrap items-center gap-2">
                <code className="text-xs break-all rounded border border-[var(--w360-border)] px-2 py-1.5 bg-[var(--w360-bg-raised)] max-w-full">{link}</code>
                <Button size="sm" variant="secondary" onClick={() => navigator.clipboard?.writeText(link).then(() => toast.show("Link copied"), () => toast.show("Couldn't copy; select the link instead.", { tone: "error" }))}>
                  <Copy size={14} aria-hidden /> Copy
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                className="self-start"
                onClick={async () => {
                  try {
                    setLink((await clientService.invite(r.id)).link);
                  } catch (err) {
                    toast.show(errText(err, "Couldn't make a link."), { tone: "error" });
                  }
                }}
              >
                {r.app.inviteActiveUntil ? "Make a new link" : "Make an invite link"}
              </Button>
            )}
          </>
        ) : (
          <p className="text-sm text-[var(--w360-text-muted)]">Her coaches keep her record. {b.age !== null && b.age < 18 ? "Only adults can sign in to Women360." : ""}</p>
        )}
      </section>

      {r.measurements && (
        <section aria-labelledby="cr-measure" className="flex flex-col gap-3 border-t border-[var(--w360-border)] pt-5">
          <div className="flex items-center justify-between gap-2">
            <h3 id="cr-measure" className="font-display text-lg font-semibold">Measurements</h3>
            <Button size="sm" variant="secondary" onClick={() => setDialog("measure")}>Add measurements</Button>
          </div>
          {r.measurements.length === 0 ? (
            <p className="text-sm text-[var(--w360-text-muted)]">Not recorded yet.</p>
          ) : (
            <div className="relative overflow-x-auto">
              <table className="text-sm w-full tabular-nums">
                <caption className="sr-only">Measurements by date, newest first</caption>
                <thead>
                  <tr className="text-left text-[var(--w360-text-muted)]">
                    {["Date", "Height", "Weight", "BMI", "Waist", "Hip", "Waist-hip", "Chest", "Arm", "Thigh", ""].map((h, i) => (
                      <th key={i} scope="col" className="font-medium py-1.5 pr-3 whitespace-nowrap">{h || <span className="sr-only">Remove</span>}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--w360-border)]">
                  {r.measurements.map((m) => (
                    <tr key={m.id}>
                      <td className="py-1.5 pr-3 whitespace-nowrap">{shortDate(m.date)}</td>
                      {[m.heightCm, m.weightKg, m.bmi, m.waistCm, m.hipCm, m.waistHipRatio, m.chestCm, m.armCm, m.thighCm].map((v, i) => (
                        <td key={i} className="py-1.5 pr-3">{v ?? "—"}</td>
                      ))}
                      <td className="py-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Remove the measurements of ${shortDate(m.date)}`}
                          onClick={async () => {
                            try {
                              await clientService.deleteMeasurement(r.id, m.id);
                              load();
                            } catch (err) {
                              toast.show(errText(err, "Couldn't remove it."), { tone: "error" });
                            }
                          }}
                        >
                          Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-[var(--w360-text-muted)] mt-1">Centimetres and kilograms. BMI and waist-hip ratio are worked out from the numbers above.</p>
            </div>
          )}
        </section>
      )}

      {intakeSections.map((s) => (
        <IntakeSectionCard
          key={s}
          title={form.sections[s].title}
          fields={form.sections[s].fields}
          answers={r.intake[s] ?? {}}
          onSave={async (answers) => {
            try {
              await clientService.saveSection(r.id, s, answers);
              toast.show(`${form.sections[s].title} saved`);
              load();
              return null;
            } catch (err) {
              return errText(err, "Couldn't save this section.");
            }
          }}
        />
      ))}

      {r.app.usesApp && <ClientLogs clientId={r.id} />}

      <section aria-labelledby="cr-consult" className="flex flex-col gap-3 border-t border-[var(--w360-border)] pt-5">
        <div className="flex items-center justify-between gap-2">
          <h3 id="cr-consult" className="font-display text-lg font-semibold">Consultations and follow-ups</h3>
          <Button size="sm" onClick={() => setDialog("consult")}>Record a consultation</Button>
        </div>
        {r.consultations.length === 0 ? (
          <p className="text-sm text-[var(--w360-text-muted)]">None yet in your specialities.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {r.consultations.map((c) => (
              <li key={c.id} className="flex flex-col gap-1 text-sm">
                <p className="font-medium tabular-nums">
                  {shortDate(c.date)} <Badge>{SPECIALITY_LABEL[c.area]}</Badge>{" "}
                  <span className="font-normal text-[var(--w360-text-muted)]">{c.mine ? "You" : c.coach?.name ?? "A former coach"}</span>
                </p>
                {(c.targetWeightKg !== null || c.targetDate) && (
                  <p className="tabular-nums">Target: {[c.targetWeightKg !== null ? `${c.targetWeightKg} kg` : null, c.targetDate ? `by ${shortDate(c.targetDate)}` : null].filter(Boolean).join(" ")}</p>
                )}
                {c.planGiven && <p className="whitespace-pre-line"><span className="text-[var(--w360-text-muted)]">Plan given: </span>{c.planGiven}</p>}
                {c.notes && <p className="whitespace-pre-line text-[var(--w360-text-muted)]">Notes: {c.notes}</p>}
                {c.nextFollowUp && <p className="tabular-nums">Next follow-up: {shortDate(c.nextFollowUp)}</p>}
                {c.mine && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="self-start"
                    onClick={async () => {
                      try {
                        await clientService.deleteConsultation(c.id);
                        refresh();
                      } catch (err) {
                        toast.show(errText(err, "Couldn't remove it."), { tone: "error" });
                      }
                    }}
                  >
                    Remove<span className="sr-only"> the consultation of {shortDate(c.date)}</span>
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap gap-2 border-t border-[var(--w360-border)] pt-4">
        {r.coaches.length > 1 || r.app.usesApp ? (
          <Button size="sm" variant="ghost" onClick={() => setDialog("leave")}>Stop being her coach</Button>
        ) : null}
        {!r.app.usesApp && <Button size="sm" variant="danger" onClick={() => setDialog("remove")}>Delete this record</Button>}
      </div>

      <BasicDialog open={dialog === "basic"} record={r} onClose={() => setDialog(null)} onSaved={refresh} />
      <MeasureDialog open={dialog === "measure"} clientId={r.id} onClose={() => setDialog(null)} onSaved={load} />
      <ConsultDialog open={dialog === "consult"} clientId={r.id} mine={r.mySpecialities} onClose={() => setDialog(null)} onSaved={refresh} />
      <AddCoachDialog open={dialog === "coach"} clientId={r.id} current={r.coaches.map((c) => c.id)} onClose={() => setDialog(null)} onSaved={load} />
      <ConfirmDialog
        open={dialog === "remove"}
        title={`Delete ${b.name}'s record?`}
        description="Everything recorded about her (details, assessment, measurements, consultations) is deleted for good, for all her coaches."
        confirmLabel="Delete record"
        onCancel={() => setDialog(null)}
        onConfirm={async () => {
          setDialog(null);
          try {
            await clientService.remove(r.id);
            toast.show("Record deleted");
            onRemoved();
          } catch (err) {
            toast.show(errText(err, "Couldn't delete it."), { tone: "error" });
          }
        }}
      />
      <ConfirmDialog
        open={dialog === "leave"}
        title="Stop being her coach?"
        description="You'll no longer see her record. Her other coaches keep theirs, and what you wrote stays in her record."
        confirmLabel="Stop"
        destructive={false}
        onCancel={() => setDialog(null)}
        onConfirm={async () => {
          setDialog(null);
          try {
            await clientService.leave(r.id);
            onRemoved();
          } catch (err) {
            toast.show(errText(err, "Couldn't do that."), { tone: "error" });
          }
        }}
      />
    </div>
  );
}

function BasicDialog({ open, record, onClose, onSaved }: { open: boolean; record: ClientRecord; onClose: () => void; onSaved: () => void }) {
  const b = record.basic;
  const [f, setF] = useState({ name: b.name, gender: b.gender, phone: b.phone ?? "", email: b.email ?? "", address: b.address ?? "", occupation: b.occupation ?? "", marital: b.maritalStatus, cycle: b.tracksCycle ? "yes" : "no" });
  const [error, setError] = useState("");
  useEffect(() => {
    if (open) setF({ name: b.name, gender: b.gender, phone: b.phone ?? "", email: b.email ?? "", address: b.address ?? "", occupation: b.occupation ?? "", marital: b.maritalStatus, cycle: b.tracksCycle ? "yes" : "no" });
  }, [open, b]);
  return (
    <Modal open={open} onClose={onClose} title="Edit details">
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!f.name.trim()) return setError("Enter her name.");
          try {
            await clientService.updateBasic(record.id, {
              name: f.name.trim(), gender: f.gender, phone: f.phone.trim() || null, address: f.address.trim() || null, occupation: f.occupation.trim() || null,
              maritalStatus: f.marital, tracksCycle: f.cycle === "yes", ...(record.app.usesApp ? {} : { email: f.email.trim() || null }),
            });
            onSaved();
            onClose();
          } catch (err) {
            setError(errText(err, "Couldn't save."));
          }
        }}
      >
        <Input label="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={80} />
        <ChoiceRow label="Gender" choices={GENDERS.map((g) => ({ value: g, label: g }))} value={f.gender} onChange={(v) => setF({ ...f, gender: v })} />
        <SegmentedChoice<string> label="Menstrual history and cycle tracker" options={[{ value: "yes", label: "Applies" }, { value: "no", label: "Doesn't apply" }]} value={f.cycle} onChange={(v) => setF({ ...f, cycle: v })} />
        <Input label="Phone (optional)" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} maxLength={30} />
        {!record.app.usesApp && <Input label="Email (optional)" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} maxLength={200} />}
        <TextArea label="Address" optional rows={2} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} maxLength={300} />
        <Input label="Occupation (optional)" value={f.occupation} onChange={(e) => setF({ ...f, occupation: e.target.value })} maxLength={80} />
        <ChoiceRow label="Marital status" choices={MARITAL.map((m) => ({ value: m, label: m }))} value={f.marital} onChange={(v) => setF({ ...f, marital: v })} />
        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <Button type="submit">Save</Button>
      </form>
    </Modal>
  );
}

const MEASURES: { key: "heightCm" | "weightKg" | "waistCm" | "hipCm" | "chestCm" | "armCm" | "thighCm"; label: string; unit: string; max: number; start: number }[] = [
  { key: "heightCm", label: "Height", unit: "cm", max: 260, start: 160 },
  { key: "weightKg", label: "Weight", unit: "kg", max: 400, start: 60 },
  { key: "waistCm", label: "Waist", unit: "cm", max: 300, start: 80 },
  { key: "hipCm", label: "Hip", unit: "cm", max: 300, start: 95 },
  { key: "chestCm", label: "Chest", unit: "cm", max: 300, start: 90 },
  { key: "armCm", label: "Arm", unit: "cm", max: 120, start: 28 },
  { key: "thighCm", label: "Thigh", unit: "cm", max: 200, start: 55 },
];

function MeasureDialog({ open, clientId, onClose, onSaved }: { open: boolean; clientId: string; onClose: () => void; onSaved: () => void }) {
  const [date, setDate] = useState(localDateISO());
  const [v, setV] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  useEffect(() => {
    if (open) {
      setV({});
      setDate(localDateISO());
      setError("");
    }
  }, [open]);
  return (
    <Modal open={open} onClose={onClose} title="Add measurements" size="sm">
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (MEASURES.every((m) => !v[m.key])) return setError("Enter at least one measurement.");
          try {
            await clientService.addMeasurement(clientId, { date, ...Object.fromEntries(MEASURES.map((m) => [m.key, num(v[m.key] ?? "")])) });
            onSaved();
            onClose();
          } catch (err) {
            setError(errText(err, "Couldn't save them."));
          }
        }}
      >
        <Input label="Date" type="date" value={date} max={localDateISO()} onChange={(e) => setDate(e.target.value)} />
        {MEASURES.map((m) => (
          <NumberField key={m.key} label={m.label} suffix={m.unit} optional max={m.max} step={0.5} startAt={m.start} value={v[m.key] ?? ""} onChange={(x) => setV((s) => ({ ...s, [m.key]: x }))} />
        ))}
        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <Button type="submit">Save</Button>
      </form>
    </Modal>
  );
}

function ConsultDialog({ open, clientId, mine, onClose, onSaved }: { open: boolean; clientId: string; mine: Speciality[]; onClose: () => void; onSaved: () => void }) {
  const areas = mine.includes("GENERAL") ? (Object.keys(SPECIALITY_LABEL) as Speciality[]) : mine;
  const blank = { area: areas[0], date: localDateISO(), target: "", targetDate: "", plan: "", next: "", notes: "" };
  const [f, setF] = useState(blank);
  const [error, setError] = useState("");
  useEffect(() => {
    if (open) {
      setF(blank);
      setError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  return (
    <Modal open={open} onClose={onClose} title="Record a consultation">
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await clientService.addConsultation(clientId, {
              area: f.area, date: f.date, targetWeightKg: num(f.target), targetDate: f.targetDate || null, planGiven: f.plan.trim() || null, nextFollowUp: f.next || null, notes: f.notes.trim() || null,
            });
            onSaved();
            onClose();
          } catch (err) {
            setError(errText(err, "Couldn't save it."));
          }
        }}
      >
        {areas.length > 1 && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="consult-area" className="text-sm font-medium">Speciality</label>
            <select id="consult-area" value={f.area} onChange={(e) => setF({ ...f, area: e.target.value as Speciality })} className="px-3.5 py-2.5 rounded border border-[var(--w360-border)] bg-[var(--w360-bg-raised)] text-sm">
              {areas.map((a) => <option key={a} value={a}>{SPECIALITY_LABEL[a]}</option>)}
            </select>
          </div>
        )}
        <Input label="Date" type="date" value={f.date} max={localDateISO()} onChange={(e) => setF({ ...f, date: e.target.value })} />
        <TextArea label="Plan given" optional value={f.plan} onChange={(e) => setF({ ...f, plan: e.target.value })} maxLength={4000} note="She sees this, if she uses the app." />
        <div className="flex flex-col gap-3">
          <NumberField label="Target weight" suffix="kg" optional max={400} step={0.5} startAt={60} value={f.target} onChange={(x) => setF({ ...f, target: x })} />
          <Input label="Target date (optional)" type="date" value={f.targetDate} onChange={(e) => setF({ ...f, targetDate: e.target.value })} />
        </div>
        <Input label="Next follow-up (optional)" type="date" value={f.next} min={localDateISO()} onChange={(e) => setF({ ...f, next: e.target.value })} />
        <TextArea label="Notes" optional value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} maxLength={4000} note="For her coaches in this speciality. In her data download, but not shown in her app." />
        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <Button type="submit">Save</Button>
      </form>
    </Modal>
  );
}

function AddCoachDialog({ open, clientId, current, onClose, onSaved }: { open: boolean; clientId: string; current: string[]; onClose: () => void; onSaved: () => void }) {
  const [list, setList] = useState<{ id: string; name: string; specialities: Speciality[] }[] | null>(null);
  const [pick, setPick] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    setPick("");
    setError("");
    clientService.directory().then(setList).catch(() => setError("Couldn't load the coaches."));
  }, [open]);
  const others = (list ?? []).filter((c) => !current.includes(c.id));
  return (
    <Modal open={open} onClose={onClose} title="Add a coach" size="sm">
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!pick) return setError("Choose a coach.");
          try {
            await clientService.addCoach(clientId, pick);
            onSaved();
            onClose();
          } catch (err) {
            setError(errText(err, "Couldn't add the coach."));
          }
        }}
      >
        <p className="text-sm text-[var(--w360-text-muted)]">They'll see the parts of her record that match their specialities.</p>
        {list && others.length === 0 ? (
          <p className="text-sm">Every coach in the practice already looks after her.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="add-coach" className="text-sm font-medium">Coach</label>
            <select id="add-coach" value={pick} onChange={(e) => setPick(e.target.value)} className="px-3.5 py-2.5 rounded border border-[var(--w360-border)] bg-[var(--w360-bg-raised)] text-sm">
              <option value="">Choose a coach</option>
              {others.map((c) => (
                <option key={c.id} value={c.id}>{c.name}: {c.specialities.map((s) => SPECIALITY_LABEL[s]).join(", ")}</option>
              ))}
            </select>
          </div>
        )}
        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <Button type="submit" disabled={!pick}>Add</Button>
      </form>
    </Modal>
  );
}
