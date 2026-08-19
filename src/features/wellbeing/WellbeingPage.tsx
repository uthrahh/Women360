import { useEffect, useState } from "react";
import { wellbeingService } from "@/services/wellbeingService";
import type { WellbeingEntry } from "@/types";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/states";
import { useToast } from "@/components/ui/Toast";
import { LineChart, Line, XAxis, ResponsiveContainer, Tooltip, Legend } from "recharts";

const MOOD_LABELS = ["Struggling", "Low", "Okay", "Good", "Great"];

export default function WellbeingPage() {
  const [data, setData] = useState<WellbeingEntry[] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const toast = useToast();

  useEffect(() => {
    wellbeingService.getWeek().then(setData);
  }, []);

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
          <Button
            disabled={selected === null}
            onClick={() => {
              if (selected === null) return;
              const last = data[data.length - 1];
              wellbeingService
                .logToday({ mood: selected, stress: last?.stress ?? 2, energy: last?.energy ?? 2 })
                .then((entry) => {
                  setData((d) => {
                    if (!d) return d;
                    const withoutToday = d.filter((e) => e.date !== "Today");
                    return [...withoutToday, entry].slice(-7);
                  });
                  toast.show("Mood logged for today");
                  setSelected(null);
                });
            }}
          >
            Save today's mood
          </Button>
        </CardBody>
      </Card>

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
                <Line type="monotone" dataKey="energy" name="Energy" stroke="#B85468" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="stress" name="Stress" stroke="#A79A8B" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 3" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
