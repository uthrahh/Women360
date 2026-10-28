import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { healthService } from "@/services/healthService";
import { localDateISO } from "@/services/mappers";
import { Card, CardBody } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { LoadingState, EmptyState } from "@/components/ui/states";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { LogPopover } from "@/components/ui/LogPopover";
import { Input } from "@/components/ui/Input";
import { ItemList } from "@/components/ui/ItemList";
import { NumberField } from "@/components/ui/NumberField";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { useApp } from "@/context/AppContext";
import type { Appointment, Medication, MedicationAdherence, MedicationDose, VitalMeasurement } from "@/types";
import { Pill, CalendarClock, Plus, Check, X as XIcon } from "lucide-react";
import { PreventiveCare } from "./PreventiveCare";
import { ReproductiveHealthTab } from "./ReproductiveHealthTab";
import { Hint } from "@/components/ui/Hint";

interface MedFormValues {
  name: string;
  dose: string;
  schedule: string;
  times: string[];
  remaining: string;
}

function emptyMedForm(): MedFormValues {
  return { name: "", dose: "", schedule: "", times: [], remaining: "" };
}

function medToForm(m: Medication): MedFormValues {
  return {
    name: m.name,
    dose: m.dose,
    schedule: m.schedule,
    times: m.times ?? [],
    remaining: m.remaining !== undefined ? String(m.remaining) : "",
  };
}

const DOSE_STATUS_LABEL: Record<MedicationDose["status"], string> = {
  PENDING: "Due later today",
  OVERDUE: "Overdue",
  TAKEN: "Taken",
  SKIPPED: "Skipped",
};

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
  const [todayDoses, setTodayDoses] = useState<MedicationDose[]>([]);
  const [adherence, setAdherence] = useState<MedicationAdherence | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const toast = useToast();

  function refreshToday() {
    healthService.getTodayMedications().then(setTodayDoses);
    healthService.getAdherence(7).then(setAdherence);
  }

  async function markDose(dose: MedicationDose, status: "TAKEN" | "SKIPPED") {
    try {
      await healthService.logMedicationDose(dose.medicationId, dose.scheduledFor, status);
      refreshToday();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't update that dose. Please try again.", { tone: "error" });
    }
  }

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
    refreshToday();
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
      times: medForm.times.filter(Boolean),
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
      refreshToday();
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
      refreshToday();
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

  const vitalForm = (
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
  );

  const addModal = (
    <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add a measurement" size="sm">
      {vitalForm}
    </Modal>
  );

  const medForm_ = (
      <form className="flex flex-col gap-4" onSubmit={handleSubmitMed}>
        <Input label="Name" value={medForm.name} onChange={(e) => setMedForm((f) => ({ ...f, name: e.target.value }))} error={medErrors.name} required />
        <Input label="Dose" placeholder="e.g. 500mg" value={medForm.dose} onChange={(e) => setMedForm((f) => ({ ...f, dose: e.target.value }))} error={medErrors.dose} required />
        <Input label="Schedule" placeholder="e.g. Every morning" value={medForm.schedule} onChange={(e) => setMedForm((f) => ({ ...f, schedule: e.target.value }))} error={medErrors.schedule} required />
        <NumberField label="Remaining" suffix="left" optional max={1000} startAt={30} value={medForm.remaining} onChange={(v) => setMedForm((f) => ({ ...f, remaining: v }))} error={medErrors.remaining} hint="Optional: how many doses you have left." />
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium senior:text-lg">Reminder times (optional)</span>
          <Hint id="med-reminder" className="text-xs text-[var(--w360-text-muted)]">Shown in-app as due/overdue when you open Women360 — not a push notification.</Hint>
          {medForm.times.map((t, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="time"
                value={t}
                onChange={(e) => setMedForm((f) => ({ ...f, times: f.times.map((x, idx) => (idx === i ? e.target.value : x)) }))}
                className="px-3.5 py-2.5 rounded border border-[var(--w360-border)] bg-[var(--w360-bg-raised)] text-[var(--w360-text)] text-sm"
              />
              <button
                type="button"
                onClick={() => setMedForm((f) => ({ ...f, times: f.times.filter((_, idx) => idx !== i) }))}
                aria-label="Remove this reminder time"
                className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950/40 text-[var(--w360-text-muted)] hover:text-red-600"
              >
                <XIcon size={16} />
              </button>
            </div>
          ))}
          <Button type="button" variant="secondary" size="sm" className="w-fit" onClick={() => setMedForm((f) => ({ ...f, times: [...f.times, "08:00"] }))}>
            <Plus size={14} /> Add a reminder time
          </Button>
        </div>
        <Button type="submit" disabled={medSaving}>{medSaving ? "Saving…" : "Save medicine"}</Button>
        {medModal !== null && medModal !== "new" && (
          <Button
            type="button"
            variant="danger"
            onClick={() => {
              setMedDeleteTarget(medModal);
              setMedModal(null);
            }}
          >
            Delete this medicine
          </Button>
        )}
      </form>
  );

  const medModalUi = (
    <Modal open={medModal !== null && medModal !== "new"} onClose={() => setMedModal(null)} title="Edit medicine" size="sm">
      {medForm_}
    </Modal>
  );

  const apptForm_ = (
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
        {apptModal !== null && apptModal !== "new" && (
          <Button
            type="button"
            variant="danger"
            onClick={() => {
              setApptDeleteTarget(apptModal);
              setApptModal(null);
            }}
          >
            Delete this appointment
          </Button>
        )}
      </form>
  );

  const apptModalUi = (
    <Modal open={apptModal !== null && apptModal !== "new"} onClose={() => setApptModal(null)} title="Edit appointment" size="sm">
      {apptForm_}
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
                  <LogPopover
                    open={addOpen}
                    onOpenChange={setAddOpen}
                    triggerLabel="Add measurement"
                    triggerIcon={<Plus size={15} />}
                    triggerVariant="secondary"
                    title="Add a measurement"
                  >
                    {vitalForm}
                  </LogPopover>
                </div>
                {vitals.length === 0 ? (
                  <EmptyState title="No measurements yet" description="Log your first weight, blood pressure or resting heart rate." />
                ) : (
                  <ItemList
                  ariaLabel="Measurements"
                    selectOnHover={false}
                    maxHeight={460}
                    items={vitals.map((v) => ({
                      id: v.id,
                      title: v.type.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()),
                      description: v.date,
                      meta: v.value,
                    }))}
                  />
                )}
              </div>
            ),
          },
          {
            id: "medicines", label: "My medicines",
            content: (
              <div className="flex flex-col gap-3">
                <div className="flex justify-end">
                  <LogPopover
                    open={medModal === "new"}
                    onOpenChange={(o) => (o ? openAddMed() : setMedModal(null))}
                    triggerLabel="Add medicine"
                    triggerIcon={<Plus size={15} />}
                    triggerVariant="secondary"
                    title="Add medicine"
                  >
                    {medForm_}
                  </LogPopover>
                </div>
                {todayDoses.length > 0 && (
                  <Card>
                    <CardBody className="pt-5 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium senior:text-lg">Today's doses</p>
                        {adherence?.pct !== null && adherence !== null && (
                          <span className="text-xs text-[var(--w360-text-muted)]">{adherence.pct}% taken, last 7 days</span>
                        )}
                      </div>
                      {todayDoses.map((d) => (
                        <div key={`${d.medicationId}-${d.scheduledFor}`} className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{d.medicationName} · {d.dose}</p>
                            <p className={`text-xs mt-0.5 ${d.status === "OVERDUE" ? "text-red-600 dark:text-red-400" : "text-[var(--w360-text-muted)]"}`}>
                              {new Date(d.scheduledFor).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} · {DOSE_STATUS_LABEL[d.status]}
                            </p>
                          </div>
                          {(d.status === "PENDING" || d.status === "OVERDUE") && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                onClick={() => markDose(d, "TAKEN")}
                                aria-label={`Mark ${d.medicationName} as taken`}
                                className="p-1.5 rounded hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-[var(--w360-text-muted)] hover:text-emerald-600"
                              >
                                <Check size={16} />
                              </button>
                              <button
                                onClick={() => markDose(d, "SKIPPED")}
                                aria-label={`Mark ${d.medicationName} as skipped`}
                                className="p-1.5 rounded hover:bg-black/[0.05] dark:hover:bg-white/[0.08] text-[var(--w360-text-muted)]"
                              >
                                <XIcon size={16} />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </CardBody>
                  </Card>
                )}
                {meds.length === 0 ? (
                  <EmptyState title="No medicines added yet" description="Add a medicine to keep track of your dose and schedule." />
                ) : (
                  <>
                    <Hint id="health-select-med" className="text-xs text-[var(--w360-text-muted)]">Select a medicine to edit or delete it.</Hint>
                    <ItemList
                  ariaLabel="Medicines"
                      maxHeight={460}
                      items={meds.map((m) => ({
                        id: m.id,
                        med: m,
                        icon: <Pill size={18} aria-hidden />,
                        title: `${m.name} · ${m.dose}`,
                        description: m.schedule,
                        meta: m.remaining !== undefined ? `${m.remaining} left` : undefined,
                      }))}
                      onItemSelect={(row) => openEditMed(row.med)}
                    />
                  </>
                )}
              </div>
            ),
          },
          {
            id: "appointments", label: "Appointments",
            content: (
              <div className="flex flex-col gap-3">
                <div className="flex justify-end">
                  <LogPopover
                    open={apptModal === "new"}
                    onOpenChange={(o) => (o ? openAddAppt() : setApptModal(null))}
                    triggerLabel="Add appointment"
                    triggerIcon={<Plus size={15} />}
                    triggerVariant="secondary"
                    title="Add appointment"
                  >
                    {apptForm_}
                  </LogPopover>
                </div>
                {appts.length === 0 ? (
                  <EmptyState title="No appointments yet" description="Add an upcoming checkup, screening or coach session." />
                ) : (
                  <>
                    <Hint id="health-select-appt" className="text-xs text-[var(--w360-text-muted)]">Select an appointment to edit or delete it.</Hint>
                    <ItemList
                  ariaLabel="Appointments"
                      maxHeight={460}
                      items={appts.map((a) => ({
                        id: a.id,
                        appt: a,
                        icon: <CalendarClock size={18} aria-hidden />,
                        title: a.title,
                        description: `${a.provider} · ${a.location}`,
                        meta: `${new Date(a.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${a.time}`,
                      }))}
                      onItemSelect={(row) => openEditAppt(row.appt)}
                    />
                  </>
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
            content: <PreventiveCare />,
          },
          {
            id: "reproductive", label: "Reproductive health",
            content: <ReproductiveHealthTab />,
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
      {(!focusTab || focusTab === "preventive") && (
        <section>
          <h2 className="font-display text-2xl font-semibold mb-3">My check-ups</h2>
          <PreventiveCare />
        </section>
      )}
      <Button size="xl" onClick={onAdd}><Plus size={20}/> Add something new</Button>
    </div>
  );
}
