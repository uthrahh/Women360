import { useEffect, useState } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { LoadingState } from "@/components/ui/states";
import { insightsService } from "@/services/insightsService";
import type { mockInsights } from "@/mock/seed";
import { ScatterChart, Scatter, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";

export default function InsightsPage() {
  const [data, setData] = useState<typeof mockInsights | null>(null);

  useEffect(() => {
    insightsService.getSummary().then(setData);
  }, []);

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
    </div>
  );
}
