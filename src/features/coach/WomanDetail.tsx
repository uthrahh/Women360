import { useEffect, useState, type FormEvent } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { useToast } from "@/components/ui/Toast";
import { Badge } from "@/components/ui/Badge";
import { coachService } from "@/services/coachService";
import { goalProgress } from "@/services/mappers";
import type { CoachNote, CoachSummary } from "@/types";
import { day, when } from "@/features/admin/format";

const MOOD = ["Struggling", "Low", "Okay", "Good", "Great"];
const short = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "UTC" });

/** One woman's shared information, and the coach's notes about her. */
export function WomanDetail({ womanId, name }: { womanId: string; name: string }) {
  const toast = useToast();
  const [summary, setSummary] = useState<CoachSummary | null>(null);
  const [notes, setNotes] = useState<CoachNote[]>([]);
  const [failed, setFailed] = useState(false);
  const [text, setText] = useState("");
  const [visible, setVisible] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setFailed(false);
    Promise.all([coachService.summary(womanId), coachService.notes(womanId)])
      .then(([s, n]) => {
        setSummary(s);
        setNotes(n);
      })
      .catch(() => setFailed(true));
  };
  useEffect(load, [womanId]);

  async function addNote(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSaving(true);
    try {
      const created = await coachService.addNote(womanId, text.trim(), visible);
      setNotes((n) => [created, ...n]);
      setText("");
      toast.show(visible ? "Note saved. She can see it." : "Note saved. Only you can see it.");
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't save that note.", { tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  if (failed) return <ErrorState title={`Couldn't load ${name}'s information`} onRetry={load} />;
  if (!summary) return <LoadingState />;

  const wellbeing = [...summary.wellbeing].reverse().map((w) => ({ day: short(w.date), Mood: w.mood, Stress: w.stress, Energy: w.energy }));
  const sleep = [...summary.sleep].reverse().map((s) => ({ day: short(s.date), Hours: s.durationHours }));
  const avgMood = summary.wellbeing.length ? summary.wellbeing.reduce((a, w) => a + w.mood, 0) / summary.wellbeing.length : null;
  const avgSleep = summary.sleep.length ? summary.sleep.reduce((a, s) => a + s.durationHours, 0) / summary.sleep.length : null;
  const minutes = summary.activity.reduce((a, e) => a + e.durationMinutes, 0);

  return (
    <div className="flex flex-col gap-4 min-w-0">
      <h2 className="font-display text-2xl font-semibold">{name}</h2>

      <section aria-label="Last two weeks" className="grid grid-cols-3 gap-3">
        <Card><CardBody className="pt-4"><p className="text-xs text-[var(--w360-text-muted)]">Average mood</p><p className="font-display text-xl font-semibold mt-1">{avgMood === null ? "-" : MOOD[Math.round(avgMood)]}</p></CardBody></Card>
        <Card><CardBody className="pt-4"><p className="text-xs text-[var(--w360-text-muted)]">Average sleep</p><p className="font-display text-xl font-semibold mt-1">{avgSleep === null ? "-" : `${avgSleep.toFixed(1)} h`}</p></CardBody></Card>
        <Card><CardBody className="pt-4"><p className="text-xs text-[var(--w360-text-muted)]">Active minutes</p><p className="font-display text-xl font-semibold mt-1">{minutes}</p></CardBody></Card>
      </section>

      <Card>
        <CardBody className="pt-5">
          <h3 className="font-medium mb-3">Mood, stress and energy</h3>
          {wellbeing.length === 0 ? (
            <p className="text-sm text-[var(--w360-text-muted)]">Nothing logged yet.</p>
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={wellbeing}>
                  <CartesianGrid stroke="var(--w360-border)" strokeDasharray="3 3" />
                  <XAxis dataKey="day" stroke="var(--w360-text-muted)" fontSize={11} tickLine={false} />
                  <YAxis domain={[0, 4]} ticks={[0, 1, 2, 3, 4]} stroke="var(--w360-text-muted)" fontSize={11} tickLine={false} width={24} />
                  <Tooltip contentStyle={{ background: "var(--w360-bg-raised)", border: "1px solid var(--w360-border)", borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="Mood" stroke="#6B1D30" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Stress" stroke="#B5651D" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Energy" stroke="#2C6E6A" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardBody>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardBody className="pt-5">
            <h3 className="font-medium mb-3">Sleep (hours)</h3>
            {sleep.length === 0 ? (
              <p className="text-sm text-[var(--w360-text-muted)]">Nothing logged yet.</p>
            ) : (
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sleep}>
                    <XAxis dataKey="day" stroke="var(--w360-text-muted)" fontSize={11} tickLine={false} />
                    <YAxis domain={[0, 10]} stroke="var(--w360-text-muted)" fontSize={11} tickLine={false} width={24} />
                    <Tooltip contentStyle={{ background: "var(--w360-bg-raised)", border: "1px solid var(--w360-border)", borderRadius: 8, fontSize: 12 }} />
                    <Line type="monotone" dataKey="Hours" stroke="#6B1D30" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardBody className="pt-5">
            <h3 className="font-medium mb-3">Recent activity</h3>
            {summary.activity.length === 0 ? (
              <p className="text-sm text-[var(--w360-text-muted)]">Nothing logged yet.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-[var(--w360-border)] text-sm">
                {summary.activity.slice(0, 6).map((a) => (
                  <li key={a.id} className="py-2 flex justify-between gap-3">
                    <span>{a.type}</span>
                    <span className="text-[var(--w360-text-muted)] tabular-nums">{short(a.date)} · {a.durationMinutes} min</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardBody className="pt-5">
            <h3 className="font-medium mb-3">Goals</h3>
            {summary.goals.length === 0 ? (
              <p className="text-sm text-[var(--w360-text-muted)]">No goals set.</p>
            ) : (
              <ul className="flex flex-col gap-4">
                {summary.goals.map((g) => {
                  const pct = goalProgress({ kind: ({ ONE_OFF: "oneOff", REACH: "reach", TOTAL: "total" } as const)[g.kind as "ONE_OFF" | "REACH" | "TOTAL"], currentValue: g.currentValue, targetValue: g.targetValue, startValue: g.startValue ?? undefined, completed: g.completed });
                  return (
                    <li key={g.id}>
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span>{g.title}</span>
                        <span className="text-[var(--w360-text-muted)] tabular-nums">{g.completed ? "Done" : `${pct}%`}</span>
                      </div>
                      <ProgressBar value={g.completed ? 100 : pct} className="mt-1.5" />
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardBody className="pt-5">
            <h3 className="font-medium mb-3">Coaching appointments</h3>
            {summary.appointments.length === 0 ? (
              <p className="text-sm text-[var(--w360-text-muted)]">None booked.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-[var(--w360-border)] text-sm">
                {summary.appointments.map((a) => (
                  <li key={a.id} className="py-2">
                    <p className="font-medium">{a.title}</p>
                    <p className="text-[var(--w360-text-muted)]">{day(a.date)} · {a.time} · {a.location}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody className="pt-5 flex flex-col gap-4">
          <h3 className="font-medium">Notes</h3>
          <form onSubmit={addNote} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="coach-note" className="text-sm font-medium">New note</label>
              <textarea
                id="coach-note"
                rows={3}
                maxLength={2000}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="What would help her next?"
                className="px-4 py-3 rounded-xl border border-[var(--w360-border)] bg-[var(--w360-bg-raised)] text-sm"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} className="w-4 h-4 accent-[var(--w360-accent)]" />
                She can see this note
              </label>
              <Button type="submit" size="sm" disabled={saving || !text.trim()}>{saving ? "Saving..." : "Save note"}</Button>
            </div>
          </form>
          {notes.length === 0 ? (
            <EmptyState title="No notes yet" description="Notes you write appear here." />
          ) : (
            <ul className="flex flex-col gap-3">
              {notes.map((n) => (
                <li key={n.id} className="rounded-xl border border-[var(--w360-border)] p-3 text-sm">
                  <p>{n.note}</p>
                  <p className="mt-2 flex items-center gap-2 text-xs text-[var(--w360-text-muted)]">
                    {when(n.createdAt)}
                    <Badge tone={n.visibleToWoman ? "accent" : "neutral"}>{n.visibleToWoman ? "She can see this" : "Only you"}</Badge>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
