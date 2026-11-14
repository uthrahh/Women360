import { useCallback, useEffect, useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceArea, CartesianGrid } from "recharts";
import { insightsService } from "@/services/insightsService";
import type { DailyPoint } from "@/types";
import { Card, CardBody } from "@/components/ui/Card";
import { ErrorState, LoadingState } from "@/components/ui/states";

type MetricKey = Exclude<keyof DailyPoint, "date" | "period">;

const METRICS: { key: MetricKey; label: string; format: (v: number) => string }[] = [
  { key: "sleepHours", label: "Sleep", format: (v) => `${v} h` },
  { key: "sleepQuality", label: "Sleep quality", format: (v) => `${v} of 5` },
  { key: "mood", label: "Mood", format: (v) => `${v + 1} of 5` },
  { key: "energy", label: "Energy", format: (v) => `${v + 1} of 5` },
  { key: "stress", label: "Stress", format: (v) => `${v + 1} of 5` },
  { key: "steps", label: "Steps", format: (v) => v.toLocaleString() },
  { key: "activeMinutes", label: "Active minutes", format: (v) => `${v} min` },
  { key: "waterMl", label: "Water", format: (v) => `${v} ml` },
  { key: "caffeine", label: "Caffeine drinks", format: (v) => String(v) },
  { key: "alcohol", label: "Alcoholic drinks", format: (v) => String(v) },
];
const METRIC = Object.fromEntries(METRICS.map((m) => [m.key, m])) as Record<MetricKey, (typeof METRICS)[number]>;

// Three series at most, each keeping its colour while it stays selected (colour follows the metric, not its position).
const SLOT_COLOURS = ["var(--w360-series-1)", "var(--w360-series-2)", "var(--w360-series-3)"];
const SLOT_DASH = [undefined, "6 3", "2 3"];
const MAX = 3;

const shortDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });

/**
 * Several things she logs on one time line, so she can see them together instead of across three apps.
 * Each line is drawn against its own lowest and highest value in the period (one shared axis, no second scale);
 * the tooltip and the table give the real values. Period days are shaded.
 */
export function SeeItTogether() {
  const [days, setDays] = useState<30 | 90>(30);
  const [rows, setRows] = useState<DailyPoint[] | null>(null);
  const [failed, setFailed] = useState(false);
  // slot index -> metric; a removed metric frees its slot without repainting the others.
  const [slots, setSlots] = useState<(MetricKey | null)[]>(["sleepHours", "mood", null]);
  const [showTable, setShowTable] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    setRows(null);
    insightsService.daily(days).then(setRows).catch(() => setFailed(true));
  }, [days]);
  useEffect(load, [load]);

  const selected = slots.flatMap((k, slot) => (k ? [{ key: k, slot }] : []));

  function toggle(key: MetricKey) {
    setSlots((s) => {
      const at = s.indexOf(key);
      if (at >= 0) return s.map((k, i) => (i === at ? null : k));
      const free = s.indexOf(null);
      return free < 0 ? s : s.map((k, i) => (i === free ? key : k));
    });
  }

  const { chartData, periodRuns, hasAny } = useMemo(() => {
    const list = rows ?? [];
    const sel = slots.flatMap((k) => (k ? [k] : []));
    const ranges = new Map<MetricKey, { min: number; max: number }>();
    for (const key of sel) {
      const values = list.map((r) => r[key]).filter((v): v is number => v !== null);
      if (values.length) ranges.set(key, { min: Math.min(...values), max: Math.max(...values) });
    }
    const chartData = list.map((r) => {
      const point: Record<string, number | string | null> = { date: r.date };
      for (const key of sel) {
        const v = r[key];
        const range = ranges.get(key);
        // Each line is placed between 0 (her lowest in the period) and 100 (her highest); a flat line sits in the middle.
        point[key] = v === null || !range ? null : range.max === range.min ? 50 : Math.round(((v - range.min) / (range.max - range.min)) * 100);
      }
      return point;
    });
    const periodRuns: { from: string; to: string }[] = [];
    for (const r of list) {
      const last = periodRuns[periodRuns.length - 1];
      if (!r.period) continue;
      const prev = list[list.indexOf(r) - 1];
      if (last && prev?.period && last.to === prev.date) last.to = r.date;
      else periodRuns.push({ from: r.date, to: r.date });
    }
    return { chartData, periodRuns, hasAny: sel.some((key) => ranges.has(key)) };
  }, [rows, slots]);

  const rowsWithData = (rows ?? []).filter((r) => r.period || selected.some(({ key }) => r[key] !== null));

  return (
    <section aria-labelledby="see-together-title">
      <div className="mb-3">
        <h2 id="see-together-title" className="font-display text-lg font-semibold">See it together</h2>
        <p className="text-sm text-[var(--w360-text-muted)] mt-0.5">Pick up to three things you log and see them on one time line.</p>
      </div>
      <Card>
        <CardBody className="pt-5 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div role="group" aria-label="Things to show" className="flex flex-wrap gap-1.5">
              {METRICS.map((m) => {
                const slot = slots.indexOf(m.key);
                const on = slot >= 0;
                const full = !on && selected.length >= MAX;
                return (
                  <button
                    key={m.key}
                    type="button"
                    aria-pressed={on}
                    disabled={full}
                    onClick={() => toggle(m.key)}
                    title={full ? "Up to three at a time: remove one first" : undefined}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm senior:text-base transition-colors disabled:opacity-40 ${
                      on ? "border-[var(--w360-text)] text-[var(--w360-text)] font-medium" : "border-[var(--w360-border)] text-[var(--w360-text-muted)] hover:text-[var(--w360-text)]"
                    }`}
                  >
                    {on && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: SLOT_COLOURS[slot] }} aria-hidden />}
                    {m.label}
                  </button>
                );
              })}
            </div>
            <div role="group" aria-label="Period of time" className="flex gap-1">
              {([30, 90] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={days === d}
                  onClick={() => setDays(d)}
                  className={`px-3 py-1.5 rounded text-sm tabular-nums ${days === d ? "bg-[var(--w360-tint)] font-medium" : "text-[var(--w360-text-muted)] hover:text-[var(--w360-text)]"}`}
                >
                  {d} days
                </button>
              ))}
            </div>
          </div>

          {failed ? (
            <ErrorState title="Couldn't load your logs" description="Check your connection and try again." onRetry={load} />
          ) : rows === null ? (
            <LoadingState label="Loading your logs" variant="rows" />
          ) : selected.length === 0 ? (
            <p className="text-sm text-[var(--w360-text-muted)] py-8 text-center">Pick something above to see it here.</p>
          ) : !hasAny ? (
            <p className="text-sm text-[var(--w360-text-muted)] py-8 text-center">
              Nothing logged for {selected.map(({ key }) => METRIC[key].label.toLowerCase()).join(" or ")} in the last {days} days.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--w360-text-muted)]" aria-hidden>
                {selected.map(({ key, slot }) => (
                  <span key={key} className="flex items-center gap-1.5">
                    <svg width="20" height="6"><line x1="0" y1="3" x2="20" y2="3" stroke={SLOT_COLOURS[slot]} strokeWidth="2" strokeDasharray={SLOT_DASH[slot]} /></svg>
                    {METRIC[key].label}
                  </span>
                ))}
                {periodRuns.length > 0 && (
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[var(--w360-tint)] border border-[var(--w360-border)]" /> Period</span>
                )}
              </div>
              <div className="h-64" aria-hidden>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
                    <CartesianGrid vertical={false} stroke="var(--w360-border)" strokeDasharray="2 4" />
                    {periodRuns.map((p) => (
                      <ReferenceArea key={p.from} x1={p.from} x2={p.to} fill="var(--w360-tint)" fillOpacity={1} stroke="none" ifOverflow="extendDomain" />
                    ))}
                    <XAxis dataKey="date" tickFormatter={shortDate} stroke="var(--w360-text-muted)" fontSize={11} tickLine={false} axisLine={false} minTickGap={24} />
                    <YAxis domain={[0, 100]} ticks={[0, 100]} tickFormatter={(v: number) => (v === 0 ? "Low" : "High")} stroke="var(--w360-text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip
                      cursor={{ stroke: "var(--w360-text-muted)", strokeDasharray: "3 3" }}
                      content={({ active, label }) => {
                        if (!active || typeof label !== "string") return null;
                        const row = rows.find((r) => r.date === label);
                        if (!row) return null;
                        return (
                          <div className="rounded-lg border border-[var(--w360-border)] bg-[var(--w360-bg-raised)] px-3 py-2 text-xs shadow-subtle">
                            <p className="font-medium mb-1">{shortDate(label)}{row.period ? " · period" : ""}</p>
                            {selected.map(({ key, slot }) => (
                              <p key={key} className="flex items-center gap-1.5 tabular-nums">
                                <span className="w-2 h-2 rounded-full" style={{ background: SLOT_COLOURS[slot] }} />
                                {METRIC[key].label}: {row[key] === null ? "not logged" : METRIC[key].format(row[key] as number)}
                              </p>
                            ))}
                          </div>
                        );
                      }}
                    />
                    {selected.map(({ key, slot }) => (
                      <Line
                        key={key}
                        dataKey={key}
                        name={METRIC[key].label}
                        type="monotone"
                        stroke={SLOT_COLOURS[slot]}
                        strokeWidth={2}
                        strokeDasharray={SLOT_DASH[slot]}
                        dot={{ r: 2.5, strokeWidth: 0, fill: SLOT_COLOURS[slot] }}
                        activeDot={{ r: 5, stroke: "var(--w360-bg-raised)", strokeWidth: 2 }}
                        connectNulls={false}
                        isAnimationActive={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-[var(--w360-text-muted)]">
                Each line runs from your own lowest to your own highest in these {days} days, so they fit on one scale. Gaps are days
                you didn&apos;t log. Lines moving together is not proof that one causes the other.
              </p>
              <div>
                <button type="button" aria-expanded={showTable} onClick={() => setShowTable((s) => !s)} className="text-sm text-maroon-700 dark:text-maroon-300 font-medium hover:underline">
                  {showTable ? "Hide the numbers" : "Show the numbers as a table"}
                </button>
                {showTable && (
                  <div className="mt-3 max-h-80 overflow-auto rounded border border-[var(--w360-border)]">
                    <table className="w-full text-sm tabular-nums">
                      <caption className="sr-only">Your logs for the last {days} days</caption>
                      <thead className="sticky top-0 bg-[var(--w360-bg-raised)]">
                        <tr className="text-left text-xs text-[var(--w360-text-muted)]">
                          <th scope="col" className="px-3 py-2 font-medium">Day</th>
                          {selected.map(({ key }) => <th key={key} scope="col" className="px-3 py-2 font-medium">{METRIC[key].label}</th>)}
                          <th scope="col" className="px-3 py-2 font-medium">Period</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...rowsWithData].reverse().map((r) => (
                          <tr key={r.date} className="border-t border-[var(--w360-border)]">
                            <th scope="row" className="px-3 py-1.5 font-normal text-left whitespace-nowrap">{shortDate(r.date)}</th>
                            {selected.map(({ key }) => (
                              <td key={key} className="px-3 py-1.5">{r[key] === null ? "–" : METRIC[key].format(r[key] as number)}</td>
                            ))}
                            <td className="px-3 py-1.5">{r.period ? "Yes" : ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </CardBody>
      </Card>
    </section>
  );
}
