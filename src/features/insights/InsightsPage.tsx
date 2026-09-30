import { useEffect, useState } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/ui/states";
import { insightsService } from "@/services/insightsService";
import type { InsightsSummary, MetricCorrelation } from "@/types";
import { ScatterChart, Scatter, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";

const STRENGTH_TONE: Record<MetricCorrelation["strength"], "accent" | "neutral"> = {
  strong: "accent",
  moderate: "accent",
  mild: "neutral",
};

export default function InsightsPage() {
  const [data, setData] = useState<InsightsSummary | null>(null);
  const [loadError, setLoadError] = useState(false);

  function load() {
    setLoadError(false);
    setData(null);
    insightsService.getSummary().then(setData).catch(() => setLoadError(true));
  }

  useEffect(load, []);

  if (loadError) {
    return <ErrorState title="Couldn't load your insights" description="Check your connection and try again." onRetry={load} />;
  }

  if (!data) return <LoadingState label="Finding patterns in your data" />;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Insights</h1>
        <p className="text-[var(--w360-text-muted)] mt-1">A few things your data can actually tell you.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardBody className="pt-5">
            <p className="text-sm font-medium mb-1">Sleep vs mood</p>
            <p className="text-xs text-[var(--w360-text-muted)] mb-4">More sleep tends to line up with a better mood the next day.</p>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--w360-border)" />
                  <XAxis dataKey="sleep" name="Sleep (h)" stroke="var(--w360-text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis dataKey="mood" name="Mood" stroke="var(--w360-text-muted)" fontSize={12} tickLine={false} axisLine={false} domain={[0, 5]} />
                  <Tooltip contentStyle={{ background: "var(--w360-bg-raised)", border: "1px solid var(--w360-border)", borderRadius: 8, fontSize: 13 }} cursor={{ strokeDasharray: "3 3" }} />
                  <Scatter data={data.sleepMood} fill="#6B1D30" />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        <div className="flex flex-col gap-3">
          {data.cards.map((c) => (
            <Card key={c.q}>
              <CardBody className="pt-5">
                <p className="text-sm font-medium">{c.q}</p>
                <p className="text-sm text-[var(--w360-text-muted)] mt-1">{c.a}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>

      <section>
        <div className="mb-3">
          <h2 className="font-display text-lg font-semibold">Patterns across your tracked metrics</h2>
          <p className="text-sm text-[var(--w360-text-muted)] mt-0.5">
            Every pair of things you log — sleep, mood, energy, stress, activity, hydration, nutrition, period pain —
            checked against each other over the last 90 days. Only patterns strong enough to matter are shown here;
            weak or noisy ones are left out rather than reported as a false signal.
          </p>
        </div>
        {data.correlations.insufficientData ? (
          <EmptyState
            title="Not enough logged data yet"
            description="Once you've logged a handful of days across a few different areas — sleep, mood, meals, activity — real patterns can start to show up here."
          />
        ) : data.correlations.correlations.length === 0 ? (
          <EmptyState
            title="No strong patterns yet"
            description="Nothing in your logged data crosses the bar for a reliable pattern right now — that's a normal, honest result, not a gap in the analysis. Keep logging and check back."
          />
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {data.correlations.correlations.map((c) => (
              <Card key={`${c.labelA}-${c.labelB}`}>
                <CardBody className="pt-5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{c.labelA} & {c.labelB}</p>
                    {c.direction === "positive" ? (
                      <TrendingUp size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <TrendingDown size={16} className="text-maroon-600 dark:text-maroon-300 shrink-0 mt-0.5" />
                    )}
                  </div>
                  <p className="text-sm text-[var(--w360-text-muted)] mt-1.5">{c.summary}</p>
                  <div className="flex items-center gap-2 mt-3">
                    <Badge tone={STRENGTH_TONE[c.strength]} className="capitalize">{c.strength} pattern</Badge>
                    <span className="text-[11px] text-[var(--w360-text-muted)]">r = {c.r} · {c.n} days logged</span>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
        {!data.correlations.insufficientData && (
          <p className="text-[11px] text-[var(--w360-text-muted)] italic mt-3">{data.correlations.disclaimer}</p>
        )}
      </section>
    </div>
  );
}
