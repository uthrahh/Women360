import { prisma } from "@/lib/prisma";
import { cycleService } from "@/modules/cycle/cycle.service";

/**
 * Cross-domain "explain this" engine. A late period isn't just "maybe
 * pregnant," and a bad mood day isn't just "PMS" — this looks across a
 * user's OWN already-logged sleep/nutrition/activity/hydration/stress data
 * for a genuine deviation from their own baseline, and reports it as an
 * observation. It never diagnoses, never compares against population norms,
 * and never fires on a single noisy day — every factor requires a real
 * shift from the user's own recent history.
 */

const DAY_MS = 86_400_000;
const MIN_HISTORY_DAYS = 5;

export interface Factor {
  label: string;
  detail: string;
}

export interface FactorReport {
  factors: Factor[];
  insufficientData: boolean;
  disclaimer: string;
}

export const FACTORS_DISCLAIMER =
  "These are possible contributing factors based on patterns in your own logged data — not a diagnosis. If this is very different from what's normal for you, or you're worried, talk to a clinician.";

const PREGNANCY_FACTOR: Factor = {
  label: "Pregnancy",
  detail: "If you're sexually active, a late period can also mean pregnancy — consider taking a test.",
};

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isSameDate(a: Date, b: Date): boolean {
  return dateKey(a) === dateKey(b);
}

interface ScoredDay {
  date: Date;
  value: number;
}

// Sums a metric per calendar day (e.g. total calories, total active
// minutes) from raw log rows that may have several entries per day.
function dailySums<T>(rows: T[], getDate: (r: T) => Date, getValue: (r: T) => number): ScoredDay[] {
  const byDay = new Map<string, ScoredDay>();
  for (const r of rows) {
    const date = getDate(r);
    const key = dateKey(date);
    const existing = byDay.get(key);
    if (existing) existing.value += getValue(r);
    else byDay.set(key, { date, value: getValue(r) });
  }
  return [...byDay.values()];
}

// Compares the mean of the most recent `recentDays` of a metric against the
// mean of everything logged before that window — only ever the user's own
// history. Returns null (no factor possible) unless there's enough baseline
// history to trust the comparison, so this never fires on noise.
function compareToBaseline(rows: ScoredDay[], recentDays: number) {
  const cutoff = new Date(Date.now() - recentDays * DAY_MS);
  const recent = rows.filter((r) => r.date >= cutoff);
  const baseline = rows.filter((r) => r.date < cutoff);
  if (recent.length === 0 || baseline.length < MIN_HISTORY_DAYS) return null;
  return { recentMean: mean(recent.map((r) => r.value)), baselineMean: mean(baseline.map((r) => r.value)) };
}

/**
 * Ranked possible contributing factors for a late period. Pregnancy is
 * always listed (never statistically ranked against nutrition/sleep
 * signals — it isn't inferable from them) and always last, except for
 * users whose life stage makes it not applicable.
 */
export async function explainCycleDelay(userId: string): Promise<FactorReport> {
  const since = new Date(Date.now() - 60 * DAY_MS);
  const [user, sleepRows, wellbeingRows, mealRows, activityRows, medications, weightRows] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { lifeStage: true } }),
    prisma.sleepEntry.findMany({ where: { userId, date: { gte: since } }, orderBy: { date: "asc" } }),
    prisma.wellbeingEntry.findMany({ where: { userId, date: { gte: since } }, orderBy: { date: "asc" } }),
    prisma.mealEntry.findMany({ where: { userId, date: { gte: since } }, orderBy: { date: "asc" } }),
    prisma.activityEntry.findMany({ where: { userId, date: { gte: since } }, orderBy: { date: "asc" } }),
    prisma.medication.findMany({ where: { userId } }),
    prisma.vitalMeasurement.findMany({ where: { userId, type: "WEIGHT" }, orderBy: { date: "asc" } }),
  ]);

  const factors: Factor[] = [];

  const sleepStat = compareToBaseline(
    sleepRows.map((s) => ({ date: s.date, value: s.durationHours })),
    14
  );
  if (sleepStat && sleepStat.baselineMean - sleepStat.recentMean >= 1) {
    factors.push({
      label: "Less sleep than usual",
      detail: `You've been averaging about ${sleepStat.recentMean.toFixed(1)}h of sleep recently, vs your usual ${sleepStat.baselineMean.toFixed(1)}h.`,
    });
  }

  const stressStat = compareToBaseline(
    wellbeingRows.map((w) => ({ date: w.date, value: w.stress })),
    14
  );
  if (stressStat && stressStat.recentMean - stressStat.baselineMean >= 1) {
    factors.push({
      label: "Higher stress than usual",
      detail: "Your logged stress has been running higher than your recent normal.",
    });
  }

  const calorieStat = compareToBaseline(
    dailySums(mealRows, (m) => m.date, (m) => m.calories),
    14
  );
  if (calorieStat && calorieStat.baselineMean > 0 && (calorieStat.baselineMean - calorieStat.recentMean) / calorieStat.baselineMean >= 0.2) {
    factors.push({
      label: "Eating noticeably less than usual",
      detail: "Your logged calorie intake has dropped compared to your recent average — under-eating can affect cycle timing.",
    });
  }

  const activityStat = compareToBaseline(
    dailySums(activityRows, (a) => a.date, (a) => a.durationMinutes),
    14
  );
  if (activityStat && activityStat.baselineMean > 0) {
    const change = (activityStat.recentMean - activityStat.baselineMean) / activityStat.baselineMean;
    if (change <= -0.5) {
      factors.push({
        label: "Much less activity than usual",
        detail: "You've been noticeably less active than your recent normal.",
      });
    } else if (change >= 0.75) {
      factors.push({
        label: "A recent jump in activity",
        detail: "A sudden increase in exercise can also shift cycle timing.",
      });
    }
  }

  const recentMeds = medications.filter((m) => Date.now() - m.createdAt.getTime() < 60 * DAY_MS);
  if (recentMeds.length > 0) {
    factors.push({
      label: "A recently started medication",
      detail: `You added ${recentMeds.map((m) => m.name).join(", ")} recently — some medications can affect cycle timing.`,
    });
  }

  const parsedWeights = weightRows
    .map((v) => ({ date: v.date, value: Number.parseFloat(v.value) }))
    .filter((v) => Number.isFinite(v.value));
  if (parsedWeights.length >= 2) {
    const last = parsedWeights.at(-1)!;
    const earlier = parsedWeights.filter((v) => last.date.getTime() - v.date.getTime() >= 14 * DAY_MS);
    const priorRef = earlier.at(-1);
    if (priorRef && priorRef.value > 0) {
      const pctChange = Math.abs(last.value - priorRef.value) / priorRef.value;
      if (pctChange >= 0.03) {
        factors.push({
          label: last.value > priorRef.value ? "A recent increase in logged weight" : "A recent decrease in logged weight",
          detail: "Weight changes can sometimes affect cycle timing.",
        });
      }
    }
  }

  const insufficientData =
    factors.length === 0 && sleepRows.length < MIN_HISTORY_DAYS && wellbeingRows.length < MIN_HISTORY_DAYS && mealRows.length < MIN_HISTORY_DAYS;

  if (user?.lifeStage !== "MENOPAUSE" && user?.lifeStage !== "POSTMENOPAUSE") {
    factors.push(PREGNANCY_FACTOR);
  }

  return { factors, insufficientData, disclaimer: FACTORS_DISCLAIMER };
}

/**
 * Ranked possible contributing factors for today's logged low mood. Cycle
 * phase is one possible factor among several, not the default assumption.
 */
export async function explainLowMood(userId: string): Promise<FactorReport> {
  const today = new Date(dateKey(new Date()));
  const yesterday = new Date(today.getTime() - DAY_MS);
  const since = new Date(today.getTime() - 30 * DAY_MS);

  const [sleepRows, wellbeingRows, hydrationRows, activityRows, nutritionGoal, cycleSummary] = await Promise.all([
    prisma.sleepEntry.findMany({ where: { userId, date: { gte: since, lte: today } }, orderBy: { date: "asc" } }),
    prisma.wellbeingEntry.findMany({ where: { userId, date: { gte: since, lte: today } }, orderBy: { date: "asc" } }),
    prisma.hydrationLog.findMany({ where: { userId, date: { gte: since, lte: today } } }),
    prisma.activityEntry.findMany({ where: { userId, date: { gte: since, lte: today } } }),
    prisma.nutritionGoal.findUnique({ where: { userId } }),
    cycleService.getSummary(userId),
  ]);

  const factors: Factor[] = [];

  const priorNight = sleepRows.find((s) => isSameDate(s.date, yesterday));
  const earlierSleep = sleepRows.filter((s) => s.date < yesterday).map((s) => s.durationHours);
  if (priorNight && earlierSleep.length >= MIN_HISTORY_DAYS) {
    const baseline = mean(earlierSleep);
    if (baseline - priorNight.durationHours >= 1.5) {
      factors.push({
        label: "Less sleep last night",
        detail: `You slept about ${priorNight.durationHours}h, vs your recent average of ${baseline.toFixed(1)}h.`,
      });
    }
  }

  const todayHydrationMl = hydrationRows
    .filter((h) => isSameDate(h.date, today))
    .reduce((sum, h) => sum + h.amountMl, 0);
  if (nutritionGoal && hydrationRows.length >= MIN_HISTORY_DAYS && todayHydrationMl > 0 && todayHydrationMl < nutritionGoal.hydrationGoalMl * 0.4) {
    factors.push({
      label: "Low water intake today",
      detail: "You've logged well under your usual hydration goal today.",
    });
  }

  const todayWellbeing = wellbeingRows.find((w) => isSameDate(w.date, today));
  const earlierStress = wellbeingRows.filter((w) => !isSameDate(w.date, today)).map((w) => w.stress);
  if (todayWellbeing && earlierStress.length >= MIN_HISTORY_DAYS) {
    const baseline = mean(earlierStress);
    if (todayWellbeing.stress - baseline >= 1) {
      factors.push({
        label: "Higher stress today",
        detail: "Today's logged stress is above your recent normal.",
      });
    }
  }

  const todayActiveMinutes = activityRows
    .filter((a) => isSameDate(a.date, today))
    .reduce((sum, a) => sum + a.durationMinutes, 0);
  const priorActiveMinutes = dailySums(
    activityRows.filter((a) => !isSameDate(a.date, today)),
    (a) => a.date,
    (a) => a.durationMinutes
  ).map((d) => d.value);
  if (priorActiveMinutes.length >= MIN_HISTORY_DAYS) {
    const baseline = mean(priorActiveMinutes);
    if (baseline >= 15 && todayActiveMinutes === 0) {
      factors.push({
        label: "No activity logged today",
        detail: "You've usually logged some movement — today shows none yet.",
      });
    }
  }

  if (cycleSummary.phase === "menstrual" || cycleSummary.phase === "luteal") {
    factors.push({
      label: cycleSummary.phase === "menstrual" ? "You're on your period" : "You're in the days before your period",
      detail: "Hormonal shifts around this phase can affect mood for some people — it's one possible piece, not the only one.",
    });
  }

  const insufficientData = factors.length === 0 && wellbeingRows.length < MIN_HISTORY_DAYS;

  return { factors: factors.slice(0, 4), insufficientData, disclaimer: FACTORS_DISCLAIMER };
}
