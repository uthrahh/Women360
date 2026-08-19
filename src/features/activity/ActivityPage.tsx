import { useEffect, useState, type FormEvent } from "react";
import { activityService } from "@/services/activityService";
import type { ActivitySummary } from "@/types";
import { Card, CardBody } from "@/components/ui/Card";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { LoadingState } from "@/components/ui/states";
import { useToast } from "@/components/ui/Toast";
import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip } from "recharts";
import { Plus } from "lucide-react";

export default function ActivityPage() {
  const [data, setData] = useState<ActivitySummary | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const toast = useToast();

  useEffect(() => {
    activityService.getSummary().then(setData);
  }, []);

  if (!data) return <LoadingState label="Loading activity" />;

  function handleAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const type = String(form.get("type") ?? "Activity");
    const duration = Number(form.get("duration") ?? 0);
    const intensity = String(form.get("intensity") ?? "moderate") as "low" | "moderate" | "high";
    activityService
      .logActivity({ type, duration, intensity, date: "Today" })
      .then((entry) => {
        setData((d) =>
          d
            ? {
                ...d,
                entries: [entry, ...d.entries],
                activeMinutes: d.activeMinutes + duration,
              }
            : d
        );
        setAddOpen(false);
        toast.show("Activity logged");
      });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">Activity</h1>
          <p className="text-[var(--w360-text-muted)] mt-1">Steps, workouts and movement, all in one place.</p>
        </div>
        <Button onClick={() => setAddOpen(true)}><Plus size={16} /> Add activity</Button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Card>
          <CardBody className="flex items-center gap-5 pt-5">
            <ProgressRing value={(data.steps / data.stepsGoal) * 100} size={80} label={`${Math.round((data.steps / data.stepsGoal) * 100)}%`} />
            <div>
              <p className="text-sm text-[var(--w360-text-muted)]">Steps today</p>
              <p className="text-2xl font-display font-semibold tabular-nums">{data.steps.toLocaleString()}</p>
              <p className="text-xs text-[var(--w360-text-muted)]">Goal: {data.stepsGoal.toLocaleString()}</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-5 pt-5">
            <ProgressRing value={(data.activeMinutes / data.activeMinutesGoal) * 100} size={80} label={`${data.activeMinutes}m`} />
            <div>
              <p className="text-sm text-[var(--w360-text-muted)]">Active minutes</p>
              <p className="text-2xl font-display font-semibold tabular-nums">{data.activeMinutes} min</p>
              <p className="text-xs text-[var(--w360-text-muted)]">Goal: {data.activeMinutesGoal} min</p>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody className="pt-5">
          <p className="text-sm font-medium mb-3">This week</p>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.weeklyMinutes}>
                <XAxis dataKey="day" stroke="var(--w360-text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "var(--w360-bg-raised)", border: "1px solid var(--w360-border)", borderRadius: 8, fontSize: 13 }} />
                <Bar dataKey="minutes" fill="#6B1D30" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>

      <section>
        <h2 className="font-display text-lg font-semibold mb-3">Recent activity</h2>
        <Card>
          <CardBody className="p-0 divide-y divide-[var(--w360-border)]">
            {data.entries.map((e) => (
              <div key={e.id} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-sm font-medium">{e.type}</p>
                  <p className="text-xs text-[var(--w360-text-muted)] mt-0.5">{e.date}{e.notes ? ` · ${e.notes}` : ""}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={e.intensity === "high" ? "warning" : "neutral"}>{e.intensity}</Badge>
                  <span className="text-sm tabular-nums text-[var(--w360-text-muted)]">{e.duration} min</span>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      </section>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add activity" size="sm">
        <form className="flex flex-col gap-4" onSubmit={handleAdd}>
          <Input label="Activity type" name="type" placeholder="e.g. Brisk walk" required />
          <Input label="Duration (minutes)" name="duration" type="number" min={1} placeholder="e.g. 30" required />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="intensity" className="text-sm font-medium">Intensity</label>
            <select
              id="intensity"
              name="intensity"
              defaultValue="moderate"
              className="px-3.5 py-2.5 rounded border border-[var(--w360-border)] bg-[var(--w360-bg-raised)] text-[var(--w360-text)] text-sm senior:text-lg senior:py-3.5"
            >
              <option value="low">Low</option>
              <option value="moderate">Moderate</option>
              <option value="high">High</option>
            </select>
          </div>
          <Button type="submit">Save activity</Button>
        </form>
      </Modal>
    </div>
  );
}
