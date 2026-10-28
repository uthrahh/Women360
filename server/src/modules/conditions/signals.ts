/**
 * Looks at her own logged cycles, pain, energy and mood and returns the patterns that cross a
 * published guideline line, each with her own numbers as the evidence. Pure: no database, no
 * randomness, so every rule is unit-tested. Thresholds and wording are in guidelines.ts.
 *
 * Principles:
 *  - say nothing without enough logged data (never a signal from one odd month);
 *  - say nothing she already knows (a condition she has told us about gets its own panel instead);
 *  - say nothing when something else explains it (pregnancy, postpartum, age);
 *  - never a diagnosis: the output names a pattern, the line it crosses, and who to see.
 */
import { dayNumber, toIsoDay } from "@/lib/streak";
import {
  DESIGN_HEAVY_DAYS,
  DESIGN_HEAVY_PERIODS,
  DESIGN_IRREGULAR_COUNT,
  DESIGN_LOW_ENERGY_DAYS,
  DESIGN_MIN_INTERVALS,
  DESIGN_MOOD_CYCLES,
  DESIGN_MOOD_DROP,
  DESIGN_MOOD_EARLY_DAYS_MIN,
  DESIGN_MOOD_LATE_DAYS_MIN,
  DESIGN_MOOD_LOW,
  DESIGN_PAIN_PERIODS,
  DESIGN_PAIN_SEVERE,
  DESIGN_RECENT_INTERVALS,
  GUIDELINE_AMENORRHEA_DAYS,
  GUIDELINE_CYCLE_MAX,
  GUIDELINE_CYCLE_MIN,
  GUIDELINE_CYCLE_VARIATION_DAYS,
  GUIDELINE_IRREGULAR_UNTIL_AGE,
  GUIDELINE_LATE_TRANSITION_GAP_DAYS,
  GUIDELINE_PERIMENOPAUSE_FROM_AGE,
  GUIDELINE_PERIOD_MAX_DAYS,
  SIGNALS,
  type ConditionCode,
  type SignalKey,
  type Source,
} from "./guidelines";

/** One of her periods with what she logged during it (including symptom-only days). */
export interface PeriodSummary {
  start: string;
  /** Last day she logged as a period day. */
  end: string;
  /** She logged every day from the start to the end, so its length is known. */
  lengthKnown: boolean;
  /** She marked the cycle that ended at this period's start as unusual. */
  excludeCycle: boolean;
  /** Days within the period with heavy flow. */
  heavyDays: number;
  /** Strongest pain logged during the period (0 to 4), null when none was logged. */
  maxPain: number | null;
  /** Days within the period with low energy. */
  lowEnergyDays: number;
}

export interface SignalInput {
  today: string;
  age: number | null;
  lifeStage: "REPRODUCTIVE" | "PERIMENOPAUSE" | "MENOPAUSE" | "POSTMENOPAUSE" | null;
  pregnancy: "PREGNANT" | "POSTPARTUM" | null;
  /** Conditions she has told us she has. */
  declared: ConditionCode[];
  /** Oldest first. */
  periods: PeriodSummary[];
  /** Daily mood, 0 (lowest) to 4 (best). */
  mood: { date: string; mood: number }[];
}

export interface Signal {
  key: SignalKey;
  title: string;
  /** Her own numbers, one plain line each. */
  evidence: string[];
  guideline: string;
  mayCheck: string[];
  relatedTo: ConditionCode[];
  sources: Source[];
  nextStep: string;
}

const NEXT_STEP = "Consider booking a check-up with your doctor or a gynaecologist and bringing these numbers.";

const monthDay = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en", { month: "short", day: "numeric" });
};
const list = (nums: number[]) => nums.join(", ");

/** Days between her period starts, oldest first, leaving out any cycle she flagged as unusual. */
function intervals(periods: PeriodSummary[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < periods.length; i++) {
    if (periods[i].excludeCycle) continue;
    out.push(dayNumber(periods[i].start) - dayNumber(periods[i - 1].start));
  }
  return out;
}

const make = (key: SignalKey, evidence: string[]): Signal => ({ key, evidence, nextStep: NEXT_STEP, ...SIGNALS[key] });

export function evaluateSignals(input: SignalInput): Signal[] {
  const { today, age, lifeStage, pregnancy, declared, periods } = input;
  const out: Signal[] = [];
  const has = (c: ConditionCode) => declared.includes(c);
  // Pregnancy and the months after birth change cycles for their own reasons: stay quiet.
  if (pregnancy !== null) return out;

  const lengths = intervals(periods);
  const recent = lengths.slice(-DESIGN_RECENT_INTERVALS);
  const lastStart = periods.at(-1)?.start ?? null;
  const daysSince = lastStart ? dayNumber(today) - dayNumber(lastStart) : null;
  const pastMenopauseStage = lifeStage === "PERIMENOPAUSE" || lifeStage === "MENOPAUSE" || lifeStage === "POSTMENOPAUSE";

  // 1. Irregular cycle lengths (adults under 45; from that age the perimenopause signal speaks).
  if (!has("PCOS") && !pastMenopauseStage && (age === null || age < GUIDELINE_IRREGULAR_UNTIL_AGE) && recent.length >= DESIGN_MIN_INTERVALS) {
    const outside = recent.filter((d) => d < GUIDELINE_CYCLE_MIN || d > GUIDELINE_CYCLE_MAX);
    if (outside.length >= DESIGN_IRREGULAR_COUNT) {
      out.push(
        make("IRREGULAR_CYCLES", [
          `Your last ${recent.length} cycles were ${list(recent)} days long.`,
          `${outside.length} of them fell outside ${GUIDELINE_CYCLE_MIN} to ${GUIDELINE_CYCLE_MAX} days.`,
        ])
      );
    }
  }

  // 2. A long time since the last period, after periods that had been logged.
  if (periods.length >= 2 && daysSince !== null && daysSince >= GUIDELINE_AMENORRHEA_DAYS && !pastMenopauseStage) {
    out.push(make("LONG_GAP", [`Your last logged period started on ${monthDay(lastStart!)}, ${daysSince} days ago.`]));
  }

  // 3. Heavy or long periods, with low energy alongside as a hint to ask about iron.
  const lastThree = periods.slice(-3);
  const longOnes = lastThree.filter((p) => p.lengthKnown && dayNumber(p.end) - dayNumber(p.start) + 1 > GUIDELINE_PERIOD_MAX_DAYS);
  const heavyOnes = lastThree.filter((p) => p.heavyDays >= DESIGN_HEAVY_DAYS);
  if (!has("ANAEMIA") && (longOnes.length >= DESIGN_HEAVY_PERIODS || heavyOnes.length >= DESIGN_HEAVY_PERIODS)) {
    const evidence: string[] = [];
    if (longOnes.length >= DESIGN_HEAVY_PERIODS) {
      evidence.push(`${longOnes.length} of your last ${lastThree.length} periods lasted more than ${GUIDELINE_PERIOD_MAX_DAYS} days (${list(longOnes.map((p) => dayNumber(p.end) - dayNumber(p.start) + 1))} days).`);
    }
    if (heavyOnes.length >= DESIGN_HEAVY_PERIODS) {
      evidence.push(`You logged heavy flow on ${DESIGN_HEAVY_DAYS} or more days in ${heavyOnes.length} of your last ${lastThree.length} periods.`);
    }
    const lowEnergy = lastThree.reduce((n, p) => n + p.lowEnergyDays, 0);
    if (lowEnergy >= DESIGN_LOW_ENERGY_DAYS) evidence.push(`You also logged low energy on ${lowEnergy} of those days. A blood test can check your iron.`);
    out.push(make("HEAVY_OR_LONG_PERIODS", evidence));
  }

  // 4. Strong period pain across several cycles.
  const lastFour = periods.slice(-4);
  const withPain = lastFour.filter((p) => p.maxPain !== null);
  const severe = withPain.filter((p) => (p.maxPain ?? 0) >= DESIGN_PAIN_SEVERE);
  if (!has("ENDOMETRIOSIS") && withPain.length >= DESIGN_PAIN_PERIODS && severe.length >= DESIGN_PAIN_PERIODS) {
    out.push(
      make("PAINFUL_PERIODS", [
        `You logged strong pain (${DESIGN_PAIN_SEVERE} or 4 out of 4) in ${severe.length} of your last ${withPain.length} periods that have pain logged.`,
      ])
    );
  }

  // 5. Mood that dips in the week before a period and lifts after it starts, across cycles.
  if (!has("PMDD")) {
    const mood = new Map(input.mood.map((m) => [m.date, m.mood]));
    const mean = (days: string[]) => {
      const vals = days.map((d) => mood.get(d)).filter((v): v is number => v !== undefined);
      return { n: vals.length, avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0 };
    };
    const range = (from: string, count: number) => Array.from({ length: count }, (_, i) => toIsoDay(new Date((dayNumber(from) + i) * 86_400_000)));
    const evaluated: { start: string; late: number; early: number; flagged: boolean }[] = [];
    for (let i = 0; i + 1 < periods.length; i++) {
      const next = periods[i + 1].start;
      const late = mean(range(toIsoDay(new Date((dayNumber(next) - 7) * 86_400_000)), 7));
      const early = mean(range(toIsoDay(new Date((dayNumber(periods[i].start) + 5) * 86_400_000)), 5));
      if (late.n < DESIGN_MOOD_LATE_DAYS_MIN || early.n < DESIGN_MOOD_EARLY_DAYS_MIN) continue;
      evaluated.push({ start: periods[i].start, late: late.avg, early: early.avg, flagged: late.avg <= DESIGN_MOOD_LOW && early.avg - late.avg >= DESIGN_MOOD_DROP });
    }
    const lastCycles = evaluated.slice(-3);
    const flagged = lastCycles.filter((c) => c.flagged);
    if (flagged.length >= DESIGN_MOOD_CYCLES && flagged.length * 2 >= lastCycles.length) {
      out.push(
        make(
          "LUTEAL_MOOD_PATTERN",
          flagged.map((c) => `Cycle starting ${monthDay(c.start)}: your mood averaged ${c.late.toFixed(1)} in the week before your next period and ${c.early.toFixed(1)} in the week after it began (0 is lowest, 4 is best).`)
        )
      );
    }
  }

  // 6. Cycles changing the way the years before menopause do.
  if (!has("PERIMENOPAUSE") && !pastMenopauseStage && age !== null && age >= GUIDELINE_PERIMENOPAUSE_FROM_AGE) {
    const lastFive = lengths.slice(-5);
    let swings = 0;
    for (let i = 1; i < lastFive.length; i++) if (Math.abs(lastFive[i] - lastFive[i - 1]) >= GUIDELINE_CYCLE_VARIATION_DAYS) swings += 1;
    const longGapNow = periods.length >= 2 && daysSince !== null && daysSince >= GUIDELINE_LATE_TRANSITION_GAP_DAYS && daysSince < GUIDELINE_AMENORRHEA_DAYS;
    const evidence: string[] = [];
    if (lastFive.length >= DESIGN_MIN_INTERVALS && swings >= 2) {
      evidence.push(`Your last ${lastFive.length} cycles were ${list(lastFive)} days long, so consecutive cycles differed by ${GUIDELINE_CYCLE_VARIATION_DAYS} or more days ${swings} times.`);
    }
    if (longGapNow) evidence.push(`Your last period started ${daysSince} days ago.`);
    if (evidence.length > 0) out.push(make("CYCLE_CHANGES_PERIMENOPAUSE", evidence));
  }

  return out;
}
