import { prisma } from "@/lib/prisma";

/**
 * Real cross-metric correlation engine — computes an actual Pearson
 * correlation coefficient between every pair of the user's own tracked
 * daily metrics (sleep, mood, energy, stress, activity, hydration,
 * nutrition, period pain), using only days where both metrics were
 * logged. This is deliberately statistics, not a handful of hand-written
 * comparisons: every number here is computed from the user's own logged
 * rows, nothing is hard-coded per metric pair, and a pair is only ever
 * reported when it clears both a minimum sample size and a minimum
 * strength threshold — weak or noisy pairs are silently dropped rather
 * than reported as a false pattern. Correlation is never causation and
 * this never diagnoses; it's phrased as an observation, like the rest of
 * this module.
 */

const DAY_MS = 86_400_000;
const LOOKBACK_DAYS = 90;
const MIN_OVERLAPPING_DAYS = 7;
const MIN_ABS_R = 0.35;
const MAX_RESULTS = 6;

export type MetricKey =
  | "sleepHours"
  | "sleepQuality"
  | "mood"
  | "energy"
  | "stress"
  | "activeMinutes"
  | "hydrationMl"
  | "calories"
  | "proteinG"
  | "fibreG"
  | "cyclePain";

export const METRIC_LABELS: Record<MetricKey, string> = {
  sleepHours: "Sleep duration",
  sleepQuality: "Sleep quality",
  mood: "Mood",
  energy: "Energy",
  stress: "Stress",
  activeMinutes: "Active minutes",
  hydrationMl: "Hydration",
  calories: "Calories logged",
  proteinG: "Protein logged",
  fibreG: "Fibre logged",
  cyclePain: "Period pain",
};

export interface MetricCorrelation {
  metricA: MetricKey;
  metricB: MetricKey;
  labelA: string;
  labelB: string;
  r: number;
  n: number;
  direction: "positive" | "negative";
  strength: "mild" | "moderate" | "strong";
  summary: string;
}

export interface CorrelationsReport {
  correlations: MetricCorrelation[];
  insufficientData: boolean;
  disclaimer: string;
}

export const CORRELATIONS_DISCLAIMER =
  "These are statistical patterns in your own logged data over the last 90 days — a correlation, not a cause, and not a diagnosis.";

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Pearson correlation coefficient. Returns 0 for fewer than 2 points or when either series has zero variance (a constant series can't correlate with anything). */
export function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2 || ys.length !== n) return 0;
  const meanX = mean(xs);
  const meanY = mean(ys);
  let numerator = 0;
  let sumSqX = 0;
  let sumSqY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    numerator += dx * dy;
    sumSqX += dx * dx;
    sumSqY += dy * dy;
  }
  if (sumSqX === 0 || sumSqY === 0) return 0;
  return numerator / Math.sqrt(sumSqX * sumSqY);
}

function strengthOf(absR: number): MetricCorrelation["strength"] {
  if (absR >= 0.7) return "strong";
  if (absR >= 0.5) return "moderate";
  return "mild";
}

function summarize(labelA: string, labelB: string, direction: "positive" | "negative", strength: MetricCorrelation["strength"]): string {
  const verbPhrase = strength === "strong" ? "clearly comes" : strength === "moderate" ? "tends to come" : "mildly tends to come";
  const comparator = direction === "positive" ? "higher" : "lower";
  return `Higher ${labelA.toLowerCase()} ${verbPhrase} with ${comparator} ${labelB.toLowerCase()}, in your own logged data.`;
}

/**
 * Computes every pairwise correlation across a set of per-day metric
 * series, keeping only pairs with enough overlapping days and a strong
 * enough |r|. Pure and DB-free, so it's directly unit-testable —
 * `computeUserCorrelations` below is the only caller that touches Prisma.
 */
export function computeCorrelations(metrics: Partial<Record<MetricKey, Map<string, number>>>): MetricCorrelation[] {
  const keys = Object.keys(metrics) as MetricKey[];
  const results: MetricCorrelation[] = [];

  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const a = metrics[keys[i]]!;
      const b = metrics[keys[j]]!;
      const sharedDates = [...a.keys()].filter((d) => b.has(d));
      if (sharedDates.length < MIN_OVERLAPPING_DAYS) continue;

      const xs = sharedDates.map((d) => a.get(d)!);
      const ys = sharedDates.map((d) => b.get(d)!);
      const r = pearson(xs, ys);
      if (Math.abs(r) < MIN_ABS_R) continue;

      const direction: "positive" | "negative" = r >= 0 ? "positive" : "negative";
      const strength = strengthOf(Math.abs(r));
      const labelA = METRIC_LABELS[keys[i]];
      const labelB = METRIC_LABELS[keys[j]];
      results.push({
        metricA: keys[i],
        metricB: keys[j],
        labelA,
        labelB,
        r: Math.round(r * 100) / 100,
        n: sharedDates.length,
        direction,
        strength,
        summary: summarize(labelA, labelB, direction, strength),
      });
    }
  }

  results.sort((x, y) => Math.abs(y.r) - Math.abs(x.r));
  return results.slice(0, MAX_RESULTS);
}

function toDailySumMap<T>(rows: T[], getDate: (r: T) => Date, getValue: (r: T) => number): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = getDate(row).toISOString().slice(0, 10);
    map.set(key, (map.get(key) ?? 0) + getValue(row));
  }
  return map;
}

function toDailyMap<T>(rows: T[], getDate: (r: T) => Date, getValue: (r: T) => number | null): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const value = getValue(row);
    if (value === null) continue;
    map.set(getDate(row).toISOString().slice(0, 10), value);
  }
  return map;
}

export async function computeUserCorrelations(userId: string): Promise<CorrelationsReport> {
  const since = new Date(Date.now() - LOOKBACK_DAYS * DAY_MS);
  const [sleepRows, wellbeingRows, activityRows, hydrationRows, mealRows, cycleRows] = await Promise.all([
    prisma.sleepEntry.findMany({ where: { userId, date: { gte: since } } }),
    prisma.wellbeingEntry.findMany({ where: { userId, date: { gte: since } } }),
    prisma.activityEntry.findMany({ where: { userId, date: { gte: since } } }),
    prisma.hydrationLog.findMany({ where: { userId, date: { gte: since } } }),
    prisma.mealEntry.findMany({ where: { userId, date: { gte: since } } }),
    prisma.cycleEntry.findMany({ where: { userId, date: { gte: since }, pain: { not: null } } }),
  ]);

  const metrics: Partial<Record<MetricKey, Map<string, number>>> = {
    sleepHours: toDailyMap(sleepRows, (r) => r.date, (r) => r.durationHours),
    sleepQuality: toDailyMap(sleepRows, (r) => r.date, (r) => r.quality),
    mood: toDailyMap(wellbeingRows, (r) => r.date, (r) => r.mood),
    energy: toDailyMap(wellbeingRows, (r) => r.date, (r) => r.energy),
    stress: toDailyMap(wellbeingRows, (r) => r.date, (r) => r.stress),
    activeMinutes: toDailySumMap(activityRows, (r) => r.date, (r) => r.durationMinutes),
    hydrationMl: toDailySumMap(hydrationRows, (r) => r.date, (r) => r.amountMl),
    calories: toDailySumMap(mealRows, (r) => r.date, (r) => r.calories),
    proteinG: toDailySumMap(mealRows, (r) => r.date, (r) => r.proteinG),
    fibreG: toDailySumMap(mealRows, (r) => r.date, (r) => r.fibreG),
    cyclePain: toDailyMap(cycleRows, (r) => r.date, (r) => r.pain),
  };

  const totalLoggedDays = new Set([
    ...sleepRows.map((r) => r.date.toISOString().slice(0, 10)),
    ...wellbeingRows.map((r) => r.date.toISOString().slice(0, 10)),
    ...activityRows.map((r) => r.date.toISOString().slice(0, 10)),
    ...hydrationRows.map((r) => r.date.toISOString().slice(0, 10)),
    ...mealRows.map((r) => r.date.toISOString().slice(0, 10)),
  ]).size;

  if (totalLoggedDays < MIN_OVERLAPPING_DAYS) {
    return { correlations: [], insufficientData: true, disclaimer: CORRELATIONS_DISCLAIMER };
  }

  const correlations = computeCorrelations(metrics);
  return { correlations, insufficientData: false, disclaimer: CORRELATIONS_DISCLAIMER };
}
