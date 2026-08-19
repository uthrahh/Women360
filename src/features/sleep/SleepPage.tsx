import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { sleepService } from "@/services/sleepService";
import type { SleepSummary } from "@/types";
import { Card, CardBody } from "@/components/ui/Card";
import { LoadingState } from "@/components/ui/states";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { Moon, Sunrise } from "lucide-react";

export default function SleepPage() {
  const [data, setData] = useState<SleepSummary | null>(null);

  useEffect(() => {
    sleepService.getSummary().then(setData);
  }, []);

  if (!data) return <LoadingState label="Loading sleep" />;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Sleep</h1>
        <p className="text-[var(--w360-text-muted)] mt-1">How well you're resting and recovering.</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <Stat icon={<Moon size={16} />} label="Last night" value={`${data.durationHours}h`} />
        <Stat icon={<Sunrise size={16} />} label="Wake time" value={data.wakeTime} />
        <Stat label="Sleep quality" value={`${data.quality}%`} />
      </div>

      <Card>
        <CardBody className="pt-5">
          <p className="text-sm font-medium mb-1">This week</p>
          <p className="text-xs text-[var(--w360-text-muted)] mb-4">Bedtime {data.bedtime} · Consistency {data.consistencyScore}%</p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.weeklyHours}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--w360-border)" vertical={false} />
                <XAxis dataKey="day" stroke="var(--w360-text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--w360-text-muted)" fontSize={12} tickLine={false} axisLine={false} domain={[0, 9]} />
                <Tooltip contentStyle={{ background: "var(--w360-bg-raised)", border: "1px solid var(--w360-border)", borderRadius: 8, fontSize: 13 }} />
                <Line type="monotone" dataKey="hours" stroke="#6B1D30" strokeWidth={2.5} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function Stat({ icon, label, value }: { icon?: ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardBody className="pt-5">
        <div className="flex items-center gap-1.5 text-[var(--w360-text-muted)] text-xs mb-1">{icon}{label}</div>
        <p className="text-2xl font-display font-semibold tabular-nums">{value}</p>
      </CardBody>
    </Card>
  );
}
