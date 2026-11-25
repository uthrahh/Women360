import { useEffect, useState } from "react";
import { request } from "@/services/apiClient";
import { localDateISO } from "@/services/mappers";
import { shortDate } from "@/types/clients";

type Day = Record<string, string | number | boolean | null | undefined> & { date: string };
const KIND_LABEL: Record<string, string> = { food: "food and water", movement: "movement", mind: "mood", sleep: "sleep", cycle: "cycle" };
const MOOD = ["very low", "low", "okay", "good", "very good"];

function summary(d: Day): string {
  const parts: string[] = [];
  if (d.meals !== undefined) parts.push(`${d.meals} ${d.meals === 1 ? "meal" : "meals"}, ${d.calories} kcal, ${d.proteinG} g protein`);
  if (d.waterMl !== undefined) parts.push(`${d.waterMl} ml water`);
  if (d.fruitVeg !== undefined) parts.push(`${d.fruitVeg} fruit and veg`);
  if (d.activeMinutes !== undefined) parts.push(`${d.activeMinutes} min active`);
  if (d.steps !== undefined) parts.push(`${Number(d.steps).toLocaleString()} steps`);
  if (d.mood !== undefined) parts.push(`mood ${MOOD[Number(d.mood)] ?? d.mood}${d.stress !== null && d.stress !== undefined ? `, stress ${d.stress} of 4` : ""}`);
  if (d.sleepHours !== undefined) parts.push(`slept ${d.sleepHours} h (${d.sleepQuality} of 5)`);
  if (d.period) parts.push(`period${d.flow ? `, ${String(d.flow).toLowerCase()} flow` : ""}`);
  else if (d.symptoms) parts.push(`${d.symptoms} symptoms`);
  return parts.join(" · ");
}

/** What she logged in the last 14 days, cut by the server to the kinds this coach's specialities cover. Totals and ratings only. */
export function ClientLogs({ clientId }: { clientId: string }) {
  const [data, setData] = useState<{ kinds: string[]; days: Day[] } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    request<{ kinds: string[]; days: Day[] }>(`/coach/clients/${clientId}/logs?today=${localDateISO()}`).then(setData).catch(() => setFailed(true));
  }, [clientId]);
  if (failed) return <p className="text-sm text-[var(--w360-text-muted)]">Her recent logs couldn't be loaded.</p>;
  if (!data) return <p className="text-sm text-[var(--w360-text-muted)]">Loading her recent logs…</p>;
  return (
    <section aria-labelledby="cr-logs" className="flex flex-col gap-2 border-t border-[var(--w360-border)] pt-5">
      <h3 id="cr-logs" className="font-display text-lg font-semibold">What she logged, last 14 days</h3>
      <p className="text-xs text-[var(--w360-text-muted)]">Her {data.kinds.map((k) => KIND_LABEL[k]).join(", ")} logs, the ones your specialities cover. Her written notes stay private.</p>
      {data.days.length === 0 ? (
        <p className="text-sm text-[var(--w360-text-muted)]">Nothing logged in these areas in the last 14 days.</p>
      ) : (
        <ul className="flex flex-col gap-1 text-sm tabular-nums">
          {data.days.map((d) => (
            <li key={d.date}>
              <span className="text-[var(--w360-text-muted)]">{shortDate(d.date)}:</span> {summary(d)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
