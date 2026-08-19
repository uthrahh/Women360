import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { healthService } from "@/services/healthService";
import { Card, CardBody } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { Badge } from "@/components/ui/Badge";
import { LoadingState, EmptyState } from "@/components/ui/states";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { useApp } from "@/context/AppContext";
import type { Appointment, Medication, VitalMeasurement } from "@/types";
import { Pill, CalendarClock, Plus } from "lucide-react";

export default function HealthPage() {
  const { senior } = useApp();
  const [params] = useSearchParams();
  const [appts, setAppts] = useState<Appointment[] | null>(null);
  const [meds, setMeds] = useState<Medication[] | null>(null);
  const [vitals, setVitals] = useState<VitalMeasurement[] | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const toast = useToast();

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
    const today = new Date().toISOString().slice(0, 10);
    healthService.addVital({ type, value, date: today }).then((entry) => {
      setVitals((v) => (v ? [entry, ...v] : [entry]));
      setAddOpen(false);
      toast.show("Measurement saved");
    });
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
              </div>
            ),
          },
          {
            id: "medicines", label: "My medicines",
            content: (
              <div className="flex flex-col gap-3">
                {meds.map((m) => (
                  <Card key={m.id}>
                    <CardBody className="flex items-center justify-between pt-5">
                      <div className="flex items-center gap-3">
                        <Pill size={18} className="text-maroon-700 dark:text-maroon-200" />
                        <div>
                          <p className="font-medium">{m.name} · {m.dose}</p>
                          <p className="text-xs text-[var(--w360-text-muted)]">{m.schedule}</p>
                        </div>
                      </div>
                      {m.remaining !== undefined && <Badge tone={m.remaining <= 7 ? "warning" : "neutral"}>{m.remaining} left</Badge>}
                    </CardBody>
                  </Card>
                ))}
              </div>
            ),
          },
          {
            id: "appointments", label: "Appointments",
            content: (
              <div className="flex flex-col gap-3">
                {appts.map((a) => (
                  <Card key={a.id}>
                    <CardBody className="flex items-center justify-between pt-5">
                      <div className="flex items-center gap-3">
                        <CalendarClock size={18} className="text-maroon-700 dark:text-maroon-200" />
                        <div>
                          <p className="font-medium">{a.title}</p>
                          <p className="text-xs text-[var(--w360-text-muted)]">{a.provider} · {a.location}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium tabular-nums">{new Date(a.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</p>
                        <p className="text-xs text-[var(--w360-text-muted)]">{a.time}</p>
                      </div>
                    </CardBody>
                  </Card>
                ))}
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
                <p className="text-sm">Your next preventive screening is a <span className="font-medium">bone density scan</span>, scheduled for {new Date(appts[1]?.date ?? Date.now()).toLocaleDateString()}.</p>
              </CardBody></Card>
            ),
          },
        ]}
      />
      {addModal}
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
