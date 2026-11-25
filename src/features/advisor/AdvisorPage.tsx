import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { request } from "@/services/apiClient";
import { localDateISO } from "@/services/mappers";
import { habitService } from "@/services/habitService";
import { goalService } from "@/services/goalService";
import { chatService } from "@/services/chatService";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useToast } from "@/components/ui/Toast";
import { useApp } from "@/context/AppContext";

interface Idea {
  key: string;
  area: string;
  title: string;
  why: string;
  fit: number;
  source: "logs" | "ai";
  action: { type: "habit"; title: string; daysPerWeek: number; target?: number | null; unit?: string | null } | { type: "goal"; title: string; category: "PREVENTIVE" | "OTHER" };
}
interface Advice {
  ideas: Idea[];
  ai: { available: boolean; sharing: boolean };
}

const AREA: Record<string, string> = { water: "Water", food: "Food", movement: "Movement", sleep: "Sleep", wellbeing: "Wellbeing", medicines: "Medicines", "check-up": "Check-up" };
const howOften = (n: number) => (n === 7 ? "every day" : `${n} days a week`);

/**
 * The health advisor: small things that help her prevent problems and look after herself, each with the reason in her own numbers,
 * added to her habits or goals in one tap (she confirms by tapping; nothing is added for her). Ideas from her logs are always here;
 * the AI advisor adds more personal ones when it is switched on and she has agreed to share her numbers-only summary.
 */
export default function AdvisorPage() {
  const [data, setData] = useState<Advice | null>(null);
  const [ai, setAi] = useState<Idea[] | null>(null);
  const [asking, setAsking] = useState(false);
  const [failed, setFailed] = useState(false);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const toast = useToast();
  const { auth } = useApp();

  const load = useCallback(() => {
    setFailed(false);
    request<Advice>(`/advisor?today=${localDateISO()}`).then(setData).catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);

  if (failed) return <ErrorState title="Couldn't load your ideas" onRetry={load} />;
  if (!data) return <LoadingState />;

  async function take(idea: Idea) {
    try {
      if (idea.action.type === "habit") {
        await habitService.create({ title: idea.action.title, daysPerWeek: idea.action.daysPerWeek, target: idea.action.target ?? null, unit: idea.action.unit ?? null });
      } else {
        await goalService.create({ title: idea.action.title, kind: "oneOff", category: idea.action.category === "PREVENTIVE" ? "preventive" : "other" });
      }
      setAdded((s) => new Set(s).add(idea.key));
      toast.show(idea.action.type === "habit" ? `Added to your habits: ${idea.title}` : `Added to your goals: ${idea.title}`);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't add it. Please try again.", { tone: "error" });
    }
  }
  async function dismiss(idea: Idea) {
    setData((d) => (d ? { ...d, ideas: d.ideas.filter((i) => i.key !== idea.key) } : d));
    setAi((list) => list?.filter((i) => i.key !== idea.key) ?? null);
    await request("/advisor/dismiss", { method: "POST", body: JSON.stringify({ key: idea.key }) }).catch(() => {});
  }
  async function askAi() {
    setAsking(true);
    try {
      if (!data!.ai.sharing) {
        await chatService.setSharing(true);
        setData((d) => (d ? { ...d, ai: { ...d.ai, sharing: true } } : d));
      }
      const res = await request<{ ideas: Idea[] }>("/advisor/ai", { method: "POST", body: JSON.stringify({ today: localDateISO() }) });
      setAi(res.ideas);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "The AI advisor couldn't answer just now.", { tone: "error" });
    } finally {
      setAsking(false);
    }
  }

  const list = (ideas: Idea[]) => (
    <ul className="flex flex-col divide-y divide-[var(--w360-border)] border-y border-[var(--w360-border)]">
      {ideas.map((i) => (
        <li key={i.key} className="py-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="min-w-0">
            <p className="font-medium">
              {i.title} <Badge>{AREA[i.area] ?? i.area}</Badge>
            </p>
            <p className="text-sm text-[var(--w360-text-muted)] measure">{i.why}</p>
            <p className="text-xs text-[var(--w360-text-muted)] mt-0.5">
              {i.action.type === "habit" ? `A habit, ${howOften(i.action.daysPerWeek)}${i.action.target ? `, ${i.action.target} ${i.action.unit ?? ""}` : ""}` : "A one-off goal"}
            </p>
          </div>
          <div className="flex gap-1.5 shrink-0">
            {added.has(i.key) ? (
              <Link to={i.action.type === "habit" ? "/app/habits" : "/app/goals"} className="text-sm font-medium text-maroon-700 dark:text-maroon-300 px-2 py-1.5">
                Added. Open {i.action.type === "habit" ? "habits" : "goals"}
              </Link>
            ) : (
              <>
                <Button size="sm" onClick={() => take(i)}>
                  {i.action.type === "habit" ? "Add as a habit" : "Add as a goal"}
                  <span className="sr-only">: {i.title}</span>
                </Button>
                <Button size="sm" variant="ghost" onClick={() => dismiss(i)}>
                  Not for me<span className="sr-only">: {i.title}</span>
                </Button>
              </>
            )}
          </div>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="font-display text-3xl font-semibold">Health advisor</h1>
        <p className="text-[var(--w360-text-muted)] mt-1 measure">
          Small things that help you stay well, chosen from what you log and the goals you set. These are ideas, not medical advice: for a
          health worry, speak to a doctor.
        </p>
      </header>

      <section aria-labelledby="adv-logs" className="flex flex-col gap-3">
        <h2 id="adv-logs" className="font-display text-xl font-semibold">From your own logs</h2>
        {data.ideas.length === 0 ? (
          <p className="text-sm text-[var(--w360-text-muted)] measure">Nothing stands out this week. Ideas appear here as your logs show something worth working on.</p>
        ) : (
          list(data.ideas)
        )}
      </section>

      {data.ai.available && !auth.user?.isDemo && (
        <section aria-labelledby="adv-ai" className="flex flex-col gap-3">
          <h2 id="adv-ai" className="font-display text-xl font-semibold">From the AI advisor</h2>
          {ai === null ? (
            <>
              <p className="text-sm text-[var(--w360-text-muted)] measure">
                {data.ai.sharing
                  ? "The AI advisor reads a numbers-only summary of your last 30 days (no names, notes or medicines) and suggests a few more ideas. It counts as one of today's AI chat questions."
                  : "To suggest ideas, the AI advisor needs to read a numbers-only summary of your last 30 days: averages of sleep, mood, activity, water and similar, with no names, notes or medicines. Asking turns that sharing on; you can turn it off on the Ask Women360 screen. Nothing it says is stored."}
              </p>
              <Button className="self-start" onClick={askAi} disabled={asking}>
                {asking ? "Thinking…" : data.ai.sharing ? "Ask for more ideas" : "Share my summary and ask"}
              </Button>
            </>
          ) : ai.length === 0 ? (
            <p className="text-sm text-[var(--w360-text-muted)]">No new ideas this time.</p>
          ) : (
            <>
              {list(ai)}
              <p className="text-xs text-[var(--w360-text-muted)]">Written by AI and checked for things it must never suggest (medicines, supplements, fasting, weight targets). Not medical advice.</p>
            </>
          )}
        </section>
      )}
    </div>
  );
}
