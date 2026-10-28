import type { Intensity } from "@prisma/client";
import { activityByCode, resolveLevel } from "../catalog";
import { toIsoDay } from "@/lib/streak";
import { BASELINE_WEEKS, WHO_VIGOROUS_FACTOR } from "./guidelines";
import { bandOf, isoWeekday, planKindOf, type PlanBaseline } from "./planner";

export interface LoggedEntry {
  activityCode: string;
  durationMinutes: number;
  intensity: Intensity;
  date: Date;
}

/**
 * Where she is now, from her own logged activity over the last few weeks. Light effort
 * (a gentle stroll, stretching) doesn't count toward the moderate-activity total, and a
 * vigorous minute counts double, as the WHO counts it. Activity logged as "other" (from
 * before the catalog) or an everyday chore says nothing about her training, so is ignored.
 */
export function baselineFrom(entries: LoggedEntry[]): PlanBaseline {
  let aerobicEquivalent = 0;
  const strengthDays = new Set<string>();
  const minutesByCode: Record<string, number> = {};
  let counted = 0;

  for (const e of entries) {
    const kind = planKindOf(e.activityCode);
    const def = activityByCode(e.activityCode);
    if (!kind || !def) continue;
    counted += 1;
    minutesByCode[e.activityCode] = (minutesByCode[e.activityCode] ?? 0) + e.durationMinutes;
    if (kind === "AEROBIC") {
      const band = bandOf(resolveLevel(def, e.intensity).met);
      if (band === "moderate") aerobicEquivalent += e.durationMinutes;
      else if (band === "vigorous") aerobicEquivalent += e.durationMinutes * WHO_VIGOROUS_FACTOR;
    } else if (kind === "STRENGTH") {
      strengthDays.add(toIsoDay(e.date));
    }
  }
  return {
    aerobicEquivalent: aerobicEquivalent / BASELINE_WEEKS,
    strengthPerWeek: strengthDays.size / BASELINE_WEEKS,
    minutesByCode,
    hasHistory: counted > 0,
  };
}

const DEFAULT_DAYS = [1, 2, 4, 5, 6];
const DEFAULT_SESSION_MINUTES = 45;

/**
 * What the plan form starts with, so the usual case is one choice (the goal) and one tap:
 * the weekdays she already tends to be active on, her usual session length, and the
 * activities she already does most. With no history it offers a sensible starting week.
 */
export function defaultsFrom(entries: LoggedEntry[]) {
  const usable = entries.filter((e) => planKindOf(e.activityCode) !== null);

  const dayCounts = new Map<number, Set<string>>();
  for (const e of usable) {
    const iso = toIsoDay(e.date);
    const wd = isoWeekday(iso);
    dayCounts.set(wd, (dayCounts.get(wd) ?? new Set()).add(iso));
  }
  const habitual = [...dayCounts.entries()].sort((a, b) => b[1].size - a[1].size || a[0] - b[0]).slice(0, 5).map(([wd]) => wd);
  const days = [...(habitual.length >= 3 ? habitual : DEFAULT_DAYS)].sort((a, b) => a - b);

  const aerobic = usable.filter((e) => planKindOf(e.activityCode) === "AEROBIC").map((e) => e.durationMinutes).sort((a, b) => a - b);
  const median = aerobic.length ? aerobic[Math.floor(aerobic.length / 2)] : null;
  const sessionMinutes = median === null ? DEFAULT_SESSION_MINUTES : Math.min(60, Math.max(15, Math.round(median / 5) * 5));

  const byCode = new Map<string, number>();
  for (const e of usable) if (planKindOf(e.activityCode) === "AEROBIC") byCode.set(e.activityCode, (byCode.get(e.activityCode) ?? 0) + e.durationMinutes);
  const activityCodes = [...byCode.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([code]) => code);

  return { days, sessionMinutes, activityCodes };
}
