import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { healthService } from "@/services/healthService";
import { localDateISO } from "@/services/mappers";
import { Card, CardBody } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { Badge } from "@/components/ui/Badge";
import { LoadingState, EmptyState } from "@/components/ui/states";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { useApp } from "@/context/AppContext";
import type { Appointment, Medication, VitalMeasurement } from "@/types";
import { Pill, CalendarClock, Plus, Pencil, Trash2 } from "lucide-react";

interface MedFormValues {
  name: string;
  dose: string;
  schedule: string;
  remaining: string;
}

function emptyMedForm(): MedFormValues {
  return { name: "", dose: "", schedule: "", remaining: "" };
}

function medToForm(m: Medication): MedFormValues {
  return { name: m.name, dose: m.dose, schedule: m.schedule, remaining: m.remaining !== undefined ? String(m.remaining) : "" };
}

interface ApptFormValues {
  title: string;
  provider: string;
  date: string;
  time: string;
  location: string;
  kind: Appointment["kind"];
}

function emptyApptForm(): ApptFormValues {
  return { title: "", provider: "", date: localDateISO(), time: "", location: "", kind: "checkup" };
}

function apptToForm(a: Appointment): ApptFormValues {
  return { title: a.title, provider: a.provider, date: a.date.slice(0, 10), time: a.time, location: a.location, kind: a.kind };
}

export default function HealthPage() {
  const { senior } = useApp();
  const [params] = useSearchParams();
  const [appts, setAppts] = useState<Appointment[] | null>(null);
  const [meds, setMeds] = useState<Medication[] | null>(null);
  const [vitals, setVitals] = useState<VitalMeasurement[] | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const toast = useToast();

  const [medModal, setMedModal] = useState<Medication | "new" | null>(null);
  const [medForm, setMedForm] = useState<MedFormValues>(emptyMedForm());
  const [medErrors, setMedErrors] = useState<Record<string, string>>({});
  const [medSaving, setMedSaving] = useState(false);
  const [medDeleteTarget, setMedDeleteTarget] = useState<Medication | null>(null);

  const [apptModal, setApptModal] = useState<Appointment | "new" | null>(null);
  const [apptForm, setApptForm] = useState<ApptFormValues>(emptyApptForm());
  const [apptErrors, setApptErrors] = useState<Record<string, string>>({});
  const [apptSaving, setApptSaving] = useState(false);
  const [apptDeleteTarget, setApptDeleteTarget] = useState<Appointment | null>(null);

  useEffect(() => {
    healthService.getAppointments().then(setAppts);
    healthService.getMedications().then(setMeds);
    healthService.getVitals().then(setVitals);
  }, []);

  if (!appts || !meds || !vitals) return <LoadingState label="Loading your health" />;

  function handleAddVital(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const type = String(form.get("type") ?? "weight") as VitalMeasurement["type"];
    const value = String(form.get("value") ?? "");
    healthService.addVital({ type, value, date: localDateISO() }).then((entry) => {
      setVitals((v) => (v ? [entry, ...v] : [entry]));
      setAddOpen(false);
      toast.show("Measurement saved");
    });
  }

  function openAddMed() {
    setMedForm(emptyMedForm());
    setMedErrors({});
    setMedModal("new");
  }

  function openEditMed(m: Medication) {
    setMedForm(medToForm(m));
    setMedErrors({});
    setMedModal(m);
  }

  async function handleSubmitMed(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!medForm.name.trim()) errs.name = "Enter a medicine name.";
    if (!medForm.dose.trim()) errs.dose = "Enter a dose, e.g. \"500mg\".";
    if (!medForm.schedule.trim()) errs.schedule = "Enter a schedule, e.g. \"Every morning\".";
    if (medForm.remaining !== "" && (Number.isNaN(Number(medForm.remaining)) || Number(medForm.remaining) < 0)) {
      errs.remaining = "Remaining count can't be negative.";
    }
    setMedErrors(errs);
    if (Object.keys(errs).length) return;

    const input = {
      name: medForm.name.trim(),
      dose: medForm.dose.trim(),
      schedule: medForm.schedule.trim(),
      remaining: medForm.remaining !== "" ? Number(medForm.remaining) : undefined,
    };
    setMedSaving(true);
    try {
      if (medModal === "new") {
        const created = await healthService.addMedication(input);
        setMeds((m) => (m ? [created, ...m] : [created]));
        toast.show("Medicine added");
      } else if (medModal) {
        const updated = await healthService.updateMedication(medModal.id, input);
        setMeds((m) => (m ? m.map((x) => (x.id === updated.id ? updated : x)) : m));
        toast.show("Medicine updated");
      }
      setMedModal(null);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't save that medicine. Please try again.", { tone: "error" });
    } finally {
      setMedSaving(false);
    }
  }

  async function handleDeleteMed() {
    if (!medDeleteTarget) return;
    const id = medDeleteTarget.id;
    try {
      await healthService.deleteMedication(id);
      setMeds((m) => (m ? m.filter((x) => x.id !== id) : m));
      toast.show("Medicine deleted");
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't delete that medicine. Please try again.", { tone: "error" });
    } finally {
      setMedDeleteTarget(null);
    }
  }

  function openAddAppt() {
    setApptForm(emptyApptForm());
    setApptErrors({});
    setApptModal("new");
  }

  function openEditAppt(a: Appointment) {
    setApptForm(apptToForm(a));
    setApptErrors({});
    setApptModal(a);
  }

  async function handleSubmitAppt(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!apptForm.title.trim()) errs.title = "Enter what this appointment is for.";
    if (!apptForm.provider.trim()) errs.provider = "Enter a provider or doctor name.";
    if (!apptForm.date) errs.date = "Choose a date.";
    if (!apptForm.time.trim()) errs.time = "Enter a time.";
    if (!apptForm.location.trim()) errs.location = "Enter a location.";
    setApptErrors(errs);
    if (Object.keys(errs).length) return;

    const input = {
      title: apptForm.title.trim(),
      provider: apptForm.provider.trim(),
      date: apptForm.date,
      time: apptForm.time.trim(),
      location: apptForm.location.trim(),
      kind: apptForm.kind,
    };
    setApptSaving(true);
    try {
      if (apptModal === "new") {
        const created = await healthService.addAppointment(input);
        setAppts((a) => (a ? [created, ...a] : [created]));
        toast.show("Appointment added");
      } else if (apptModal) {
        const updated = await healthService.updateAppointment(apptModal.id, input);
        setAppts((a) => (a ? a.map((x) => (x.id === updated.id ? updated : x)) : a));
        toast.show("Appointment updated");
      }
      setApptModal(null);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't save that appointment. Please try again.", { tone: "error" });
    } finally {
      setApptSaving(false);
    }
  }

  async function handleDeleteAppt() {
    if (!apptDeleteTarget) return;
    const id = apptDeleteTarget.id;
    try {
      await healthService.deleteAppointment(id);
      setAppts((a) => (a ? a.filter((x) => x.id !== id) : a));
      toast.show("Appointment deleted");
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't delete that appointment. Please try again.", { tone: "error" });
    } finally {
      setApptDeleteTarget(null);
    }
  }

  const addModal = (
    <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add a measurement" size="sm">
      <form className="flex flex-col gap-4" onSubmit={handleAddVital}>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="vtype" className="text-sm font-medium senior:text-lg">What are you logging?</label>
          <select
            id="vtype"
            name="type"
            defaultValue="weight"
            className="px-3.5 py-2.5 rounded border border-[var(--w360-border)] bg-[var(--w360-bg-raised)] text-[var(--w360-text)] text-sm senior:text-lg senior:py-3.5"
          >
            <option value="weight">Weight</option>
            <option value="bloodPressure">Blood pressure</option>
            <option value="restingHR">Resting heart rate</option>
          </select>
        </div>
        <Input label="Value" name="value" placeholder="e.g. 68kg or 118/76" required />
        <Button type="submit" size="lg">Save measurement</Button>
      </form>
    </Modal>
  );

  const medModalUi = (
    <Modal open={medModal !== null} onClose={() => setMedModal(null)} title={medModal === "new" ? "Add medicine" : "Edit medicine"} size="sm">
      <form className="flex flex-col gap-4" onSubmit={handleSubmitMed}>
        <Input label="Name" value={medForm.name} onChange={(e) => setMedForm((f) => ({ ...f, name: e.target.value }))} error={medErrors.name} required />
        <Input label="Dose" placeholder="e.g. 500mg" value={medForm.dose} onChange={(e) => setMedForm((f) => ({ ...f, dose: e.target.value }))} error={medErrors.dose} required />
        <Input label="Schedule" placeholder="e.g. Every morning" value={medForm.schedule} onChange={(e) => setMedForm((f) => ({ ...f, schedule: e.target.value }))} error={medErrors.schedule} required />
        <Input label="Remaining (optional)" type="number" min={0} value={medForm.remaining} onChange={(e) => setMedForm((f) => ({ ...f, remaining: e.target.value }))} error={medErrors.remaining} />
        <Button type="submit" disabled={medSaving}>{medSaving ? "Saving…" : "Save medicine"}</Button>
      </form>
    </Modal>
  );

  const apptModalUi = (
    <Modal open={apptModal !== null} onClose={() => setApptModal(null)} title={apptModal === "new" ? "Add appointment" : "Edit appointment"} size="sm">
      <form className="flex flex-col gap-4" onSubmit={handleSubmitAppt}>
        <Input label="What's it for?" placeholder="e.g. Annual wellness checkup" value={apptForm.title} onChange={(e) => setApptForm((f) => ({ ...f, title: e.target.value }))} error={apptErrors.title} required />
        <Input label="Provider" placeholder="e.g. Dr. Anita Rao" value={apptForm.provider} onChange={(e) => setApptForm((f) => ({ ...f, provider: e.target.value }))} error={apptErrors.provider} required />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Date" type="date" value={apptForm.date} onChange={(e) => setApptForm((f) => ({ ...f, date: e.target.value }))} error={apptErrors.date} required />
          <Input label="Time" placeholder="e.g. 10:30 AM" value={apptForm.time} onChange={(e) => setApptForm((f) => ({ ...f, time: e.target.value }))} error={apptErrors.time} required />
        </div>
        <Input label="Location" placeholder="e.g. City Health Clinic" value={apptForm.location} onChange={(e) => setApptForm((f) => ({ ...f, location: e.target.value }))} error={apptErrors.location} required />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="appt-kind" className="text-sm font-medium">Type</label>
          <select
            id="appt-kind"
            value={apptForm.kind}
            onChange={(e) => setApptForm((f) => ({ ...f, kind: e.target.value as Appointment["kind"] }))}
            className="px-3.5 py-2.5 rounded border border-[var(--w360-border)] bg-[var(--w360-bg-raised)] text-[var(--w360-text)] text-sm"
          >
            <option value="checkup">Checkup</option>
            <option value="screening">Screening</option>
            <option value="vaccination">Vaccination</option>
            <option value="coach">Coach</option>
          </select>
        </div>
        <Button type="submit" disabled={apptSaving}>{apptSaving ? "Saving…" : "Save appointment"}</Button>
      </form>
    </Modal>
  );

  if (senior.seniorMode)
    return (
      <>
        <SeniorHealth appts={appts} meds={meds} focusTab={params.get("tab")} onAdd={() => setAddOpen(true)} />
        {addModal}
      </>
    );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">My Health</h1>
        <p className="text-[var(--w360-text-muted)] mt-1">Everything about your physical and preventive health, in one hub.</p>
      </div>

      <Tabs
        defaultTab={params.get("tab") ?? "physical"}
        tabs={[
          {
            id: "physical", label: "Physical health",
            content: (
              <div className="flex flex-col gap-3">
                <div className="flex justify-end">
                  <Button size="sm" variant="secondary" onClick={() => setAddOpen(true)}><Plus size={15} /> Add measurement</Button>
                </div>
                {vitals.length === 0 ? (
                  <EmptyState title="No measurements yet" description="Log your first weight, blood pressure or resting heart rate." />
                ) : (
                  <Card><CardBody className="p-0 divide-y divide-[var(--w360-border)]">
                    {vitals.map((v) => (
                      <div key={v.id} className="flex items-center justify-between px-5 py-4">
                        <span className="text-sm font-medium capitalize">{v.type.replace(/([A-Z])/g, " $1")}</span>
                        <div className="text-right">
                          <p className="text-sm tabular-nums font-medium">{v.value}</p>
                          <p className="text-xs text-[var(--w360-text-muted)]">{v.date}</p>
                        </div>
                      </div>
                    ))}
                  </CardBody></Card>
                )}
              </div>
            ),
          },
          {
            id: "medicines", label: "My medicines",
            content: (
              <div className="flex flex-col gap-3">
                <div className="flex justify-end">
                  <Button size="sm" variant="secondary" onClick={openAddMed}><Plus size={15} /> Add medicine</Button>
                </div>
                {meds.length === 0 ? (
                  <EmptyState title="No medicines added yet" description="Add a medicine to keep track of your dose and schedule." />
                ) : (
                  meds.map((m) => (
                    <Card key={m.id}>
                      <CardBody className="flex items-center justify-between pt-5 gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <Pill size={18} className="text-maroon-700 dark:text-maroon-200 shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium truncate">{m.name} · {m.dose}</p>
                            <p className="text-xs text-[var(--w360-text-muted)]">{m.schedule}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {m.remaining !== undefined && <Badge tone={m.remaining <= 7 ? "warning" : "neutral"}>{m.remaining} left</Badge>}
                          <button onClick={() => openEditMed(m)} aria-label={`Edit ${m.name}`} className="p-1.5 rounded hover:bg-black/[0.05] dark:hover:bg-white/[0.08] text-[var(--w360-text-muted)]">
                            <Pencil size={16} />
                          </button>
                          <button onClick={() => setMedDeleteTarget(m)} aria-label={`Delete ${m.name}`} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950/40 text-[var(--w360-text-muted)] hover:text-red-600">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </CardBody>
                    </Card>
                  ))
                )}
              </div>
            ),
          },
          {
            id: "appointments", label: "Appointments",
            content: (
              <div className="flex flex-col gap-3">
                <div className="flex justify-end">
                  <Button size="sm" variant="secondary" onClick={openAddAppt}><Plus size={15} /> Add appointment</Button>
                </div>
                {appts.length === 0 ? (
                  <EmptyState title="No appointments yet" description="Add an upcoming checkup, screening or coach session." />
                ) : (
                  appts.map((a) => (
                    <Card key={a.id}>
                      <CardBody className="flex items-center justify-between pt-5 gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <CalendarClock size={18} className="text-maroon-700 dark:text-maroon-200 shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium truncate">{a.title}</p>
                            <p className="text-xs text-[var(--w360-text-muted)]">{a.provider} · {a.location}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right">
                            <p className="text-sm font-medium tabular-nums">{new Date(a.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</p>
                            <p className="text-xs text-[var(--w360-text-muted)]">{a.time}</p>
                          </div>
                          <button onClick={() => openEditAppt(a)} aria-label={`Edit ${a.title}`} className="p-1.5 rounded hover:bg-black/[0.05] dark:hover:bg-white/[0.08] text-[var(--w360-text-muted)]">
                            <Pencil size={16} />
                          </button>
                          <button onClick={() => setApptDeleteTarget(a)} aria-label={`Delete ${a.title}`} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950/40 text-[var(--w360-text-muted)] hover:text-red-600">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </CardBody>
                    </Card>
                  ))
                )}
              </div>
            ),
          },
          {
            id: "mental", label: "Mental wellbeing",
            content: <EmptyState title="Nothing logged yet today" description="Head to Wellbeing to record mood, stress and energy." />,
          },
          {
            id: "preventive", label: "Preventive care",
            content: (
              <Card><CardBody className="pt-5">
                {appts[1] ? (
                  <p className="text-sm">Your next preventive screening is a <span className="font-medium">{appts[1].title.toLowerCase()}</span>, scheduled for {new Date(appts[1].date).toLocaleDateString()}.</p>
                ) : (
                  <p className="text-sm text-[var(--w360-text-muted)]">No preventive screenings scheduled yet — add one under Appointments.</p>
                )}
              </CardBody></Card>
            ),
          },
        ]}
      />
      {addModal}
      {medModalUi}
      {apptModalUi}

      <ConfirmDialog
        open={medDeleteTarget !== null}
        title="Delete this medicine?"
        description={medDeleteTarget ? `"${medDeleteTarget.name}" will be removed.` : undefined}
        confirmLabel="Delete"
        onConfirm={handleDeleteMed}
        onCancel={() => setMedDeleteTarget(null)}
      />
      <ConfirmDialog
        open={apptDeleteTarget !== null}
        title="Delete this appointment?"
        description={apptDeleteTarget ? `"${apptDeleteTarget.title}" will be removed.` : undefined}
        confirmLabel="Delete"
        onConfirm={handleDeleteAppt}
        onCancel={() => setApptDeleteTarget(null)}
      />
    </div>
  );
}

function SeniorHealth({
  appts, meds, focusTab, onAdd,
}: { appts: Appointment[]; meds: Medication[]; focusTab: string | null; onAdd: () => void }) {
  return (
    <div className="max-w-xl mx-auto p-5 flex flex-col gap-5">
      {(!focusTab || focusTab === "medicines") && (
        <section>
          <h2 className="font-display text-2xl font-semibold mb-3">My medicines</h2>
          <div className="flex flex-col gap-3">
            {meds.map((m) => (
              <Card key={m.id}><CardBody className="pt-5">
                <p className="text-lg font-medium">{m.name} — {m.dose}</p>
                <p className="text-[var(--w360-text-muted)]">{m.schedule}</p>
              </CardBody></Card>
            ))}
          </div>
        </section>
      )}
      {(!focusTab || focusTab === "appointments") && (
        <section>
          <h2 className="font-display text-2xl font-semibold mb-3">My appointments</h2>
          <div className="flex flex-col gap-3">
            {appts.map((a) => (
              <Card key={a.id}><CardBody className="pt-5">
                <p className="text-lg font-medium">{a.title}</p>
                <p className="text-[var(--w360-text-muted)]">{new Date(a.date).toLocaleDateString(undefined, { month: "long", day: "numeric" })} at {a.time}</p>
              </CardBody></Card>
            ))}
          </div>
        </section>
      )}
      <Button size="xl" onClick={onAdd}><Plus size={20}/> Add something new</Button>
    </div>
  );
}
