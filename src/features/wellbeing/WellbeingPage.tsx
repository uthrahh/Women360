import { useEffect, useState, useCallback } from "react";
import { wellbeingService } from "@/services/wellbeingService";
import type { WellbeingEntry } from "@/types";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/Toast";
import { LineChart, Line, XAxis, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { MOOD_LABELS } from "@/services/mappers";
import { insightsService } from "@/services/insightsService";
import { ExplainThisCard } from "@/components/ExplainThisCard";
import { BreathingExercise } from "@/components/BreathingExercise";
import { useFeatures } from "@/context/FeaturesContext";
import { ChoiceRow } from "@/components/ui/ChoiceRow";

const STRESS_CHOICES = [
  { value: 0, label: "Very low" },
  { value: 1, label: "Low" },
  { value: 2, label: "Some" },
  { value: 3, label: "High" },
  { value: 4, label: "Very high" },
];
const ENERGY_CHOICES = [
  { value: 0, label: "Very low" },
  { value: 1, label: "Low" },
  { value: 2, label: "Okay" },
  { value: 3, label: "Good" },
  { value: 4, label: "Very good" },
];

export default function WellbeingPage() {
  const { clinicalContent } = useFeatures();
  const [data, setData] = useState<WellbeingEntry[] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  // Stress, energy and a note are optional extras: unanswered stays unanswered (they used to be copied from the day before).
  const [stress, setStress] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [showLowMoodHelp, setShowLowMoodHelp] = useState(false);
  const [breathingOpen, setBreathingOpen] = useState(false);
  const toast = useToast();

  const [failed, setFailed] = useState(false);
  const load = useCallback(() => {
    setFailed(false);
    wellbeingService.getWeek().then(setData).catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);

  if (failed) return <ErrorState title="Couldn't load your wellbeing" description="Check your connection and try again." onRetry={load} />;
  if (!data) return <LoadingState label="Loading wellbeing" />;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Wellbeing</h1>
        <p className="text-[var(--w360-text-muted)] mt-1">How are you feeling today?</p>
      </div>

      <Card>
        <CardBody className="pt-6 flex flex-col items-center gap-4">
          <div className="flex gap-2 sm:gap-3">
            {MOOD_LABELS.map((label, i) => (
              <button
                key={label}
                onClick={() => setSelected(i)}
                className={`flex flex-col items-center gap-2 px-3 py-3 sm:px-4 rounded-lg border-2 transition-colors ${
                  selected === i
                    ? "border-maroon-600 bg-maroon-50 dark:bg-white/5"
                    : "border-transparent hover:border-[var(--w360-border)]"
                }`}
                aria-label={label}
                aria-pressed={selected === i}
              >
                <span
                  className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-sm font-display font-semibold tabular-nums border-2 ${
                    selected === i
                      ? "bg-maroon-700 border-maroon-700 text-white"
                      : "border-[var(--w360-border)] text-[var(--w360-text-muted)]"
                  }`}
                >
                  {i + 1}
                </span>
                <span className="text-xs text-[var(--w360-text-muted)] senior:text-sm">{label}</span>
              </button>
            ))}
          </div>
          {selected !== null && (
            <div className="w-full max-w-lg flex flex-col gap-4 border-t border-[var(--w360-border)] pt-4">
              <ChoiceRow label="Stress" choices={STRESS_CHOICES} value={stress} onChange={setStress} />
              <ChoiceRow label="Energy" choices={ENERGY_CHOICES} value={energy} onChange={setEnergy} />
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">
                  A note for today <span className="font-normal text-[var(--w360-text-muted)]">(optional, only you can see it)</span>
                </span>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={1000}
                  rows={3}
                  placeholder="What happened, how you felt, anything you want to remember"
                  className="px-4 py-3 rounded-xl border border-[var(--w360-border)] bg-[var(--w360-bg-raised)] text-sm senior:text-lg"
                />
              </label>
            </div>
          )}
          <Button
            disabled={selected === null || saving}
            onClick={() => {
              if (selected === null) return;
              const loggedMood = selected;
              setSaving(true);
              wellbeingService
                .logToday({
                  mood: selected,
                  ...(stress !== null ? { stress } : {}),
                  ...(energy !== null ? { energy } : {}),
                  ...(note.trim() ? { note: note.trim() } : {}),
                })
                .then((entry) => {
                  setData((d) => {
                    if (!d) return d;
                    const withoutToday = d.filter((e) => e.date !== "Today");
                    return [...withoutToday, entry].slice(-7);
                  });
                  toast.show("Saved for today");
                  setSelected(null);
                  setStress(null);
                  setEnergy(null);
                  setNote("");
                  // A low mood doesn't default to "must be PMS" — offer to
                  // look across sleep/hydration/activity/stress/cycle phase.
                  setShowLowMoodHelp(loggedMood <= 1);
                })
                .catch((err) => toast.show(err instanceof Error ? err.message : "Couldn't save that. Please try again.", { tone: "error" }))
                .finally(() => setSaving(false));
            }}
          >
            {saving ? "Saving…" : "Save today"}
          </Button>
        </CardBody>
      </Card>

      {showLowMoodHelp && (
        <>
          {clinicalContent && (
            <ExplainThisCard
              title="Not feeling great today?"
              buttonLabel="See possible reasons"
              fetchReport={() => insightsService.explainLowMood()}
            />
          )}
          <Card>
            <CardBody className="pt-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium senior:text-base">Want a moment to reset?</p>
                <p className="text-xs text-[var(--w360-text-muted)] mt-0.5">A short guided breathing exercise, no audio needed.</p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setBreathingOpen(true)}>Try it</Button>
            </CardBody>
          </Card>
        </>
      )}

      <Modal open={breathingOpen} onClose={() => setBreathingOpen(false)} title="Breathing exercise" size="sm">
        <BreathingExercise />
      </Modal>

      <Card>
        <CardBody className="pt-5">
          <p className="text-sm font-medium mb-4">This week: mood, stress & energy</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <XAxis dataKey="date" stroke="var(--w360-text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "var(--w360-bg-raised)", border: "1px solid var(--w360-border)", borderRadius: 8, fontSize: 13 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="mood" name="Mood" stroke="#6B1D30" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="energy" name="Energy" stroke="#B85468" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
                <Line type="monotone" dataKey="stress" name="Stress" stroke="#A79A8B" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 3" connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
