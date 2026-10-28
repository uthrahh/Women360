/**
 * Builds a weekly activity plan from what the person has told us and what she has
 * logged. It is plain arithmetic on her own numbers: no model, no randomness, the
 * same inputs always give the same plan, and every figure can be traced to
 * guidelines.ts. It touches no database; plan.service.ts gathers the inputs.
 *
 * The shape of a plan:
 *   - a weekly aerobic target for the goal (in "moderate-equivalent" minutes, where
 *     a vigorous minute counts double, as the WHO counts it);
 *   - a gradual build from where she is now to that target, never faster than the
 *     ramp in guidelines.ts, and never more than her chosen days and session length
 *     can hold;
 *   - strength and mobility sessions placed first (spaced out through the week),
 *     with the aerobic minutes filling the time that is left on each day;
 *   - an honest feasibility verdict that says what limits the plan (her history, the
 *     weeks she chose, or the time she has) instead of promising the target.
 */
import { activityByCode, caloriesFor, levelKeys, type ActivityDef, type LevelKey } from "../catalog";
import { dayNumber, toIsoDay } from "@/lib/streak";
import {
  BASELINE_WEEKS,
  CAUTION_ALWAYS,
  CAUTION_CONDITIONS,
  CAUTION_NO_AGE,
  CAUTION_OLDER,
  CAUTION_POSTPARTUM,
  CAUTION_PREGNANT,
  DESIGN_MIN_BLOCK,
  DESIGN_MIN_START,
  DESIGN_MOBILITY_MIN,
  DESIGN_RAMP_MIN_STEP,
  DESIGN_RAMP_SHARE,
  DESIGN_START_ABOVE_BASELINE,
  DESIGN_STRENGTH_EASE_IN_WEEKS,
  DESIGN_STRENGTH_MIN,
  DESIGN_STRENGTH_MIN_EARLY,
  EFFORT_FEEL,
  GOALS,
  MODERATE_MET_MIN,
  OLDER_AGE,
  PLAN_SOURCE,
  REVIEW,
  VIGOROUS_MET_MIN,
  WHO_OLDER_BALANCE_STRENGTH_DAYS,
  WHO_VIGOROUS_FACTOR,
  type PlanGoal,
} from "./guidelines";

export type PlanKind = "AEROBIC" | "STRENGTH" | "MOBILITY";

const KIND: Record<string, PlanKind> = {
  walking: "AEROBIC", running: "AEROBIC", hiking: "AEROBIC", cycling: "AEROBIC", "exercise-bike": "AEROBIC",
  swimming: "AEROBIC", "dance-aerobics": "AEROBIC", elliptical: "AEROBIC", "rowing-machine": "AEROBIC",
  "skipping-rope": "AEROBIC", badminton: "AEROBIC", tennis: "AEROBIC", basketball: "AEROBIC", football: "AEROBIC",
  "table-tennis": "AEROBIC",
  "strength-training": "STRENGTH", "bodyweight-training": "STRENGTH", "circuit-training": "STRENGTH",
  yoga: "MOBILITY", pilates: "MOBILITY", stretching: "MOBILITY",
};

/** Which part of a plan an activity serves; everyday chores (housework, gardening) serve none. */
export const planKindOf = (code: string): PlanKind | null => KIND[code] ?? null;

export type Band = "light" | "moderate" | "vigorous";
export const bandOf = (met: number): Band => (met >= VIGOROUS_MET_MIN ? "vigorous" : met >= MODERATE_MET_MIN ? "moderate" : "light");

// ---- Inputs -------------------------------------------------------------------------

export interface PlanRequest {
  goal: PlanGoal;
  weeks: number;
  /** ISO weekdays she can be active: 1 = Monday ... 7 = Sunday. */
  days: number[];
  /** How long she has on each of those days, in minutes. */
  sessionMinutes: number;
  /** Her own calendar day when the plan starts, "YYYY-MM-DD". */
  startDate: string;
  /** Aerobic activities she'd like, from the catalog. Empty means "use what I already do". */
  activityCodes: string[];
}

export interface PlanProfile {
  age: number | null;
  pregnancy: "PREGNANT" | "POSTPARTUM" | null;
  hasConditions: boolean;
  weightKg: number | null;
}

export interface PlanBaseline {
  /** Moderate-equivalent aerobic minutes a week, averaged over the last four weeks. */
  aerobicEquivalent: number;
  /** Strength sessions a week, averaged over the same time. */
  strengthPerWeek: number;
  /** Minutes logged per activity code over those weeks. */
  minutesByCode: Record<string, number>;
  hasHistory: boolean;
}

// ---- Output -------------------------------------------------------------------------

export interface PlanSession {
  date: string;
  /** ISO weekday, 1 = Monday ... 7 = Sunday. */
  weekday: number;
  kind: PlanKind;
  activityCode: string;
  label: string;
  intensity: LevelKey;
  /** The catalog's description of this effort level, for example "Brisk, about 5.6 km/h". */
  effort: string;
  /** How that should feel. */
  feel: string;
  minutes: number;
  caloriesEstimate: number | null;
  note?: string;
}

export interface PlanWeek {
  week: number;
  startDate: string;
  focus: string;
  aerobicMinutes: number;
  /** Moderate-equivalent aerobic minutes: what is compared with the target. */
  aerobicEquivalent: number;
  strengthSessions: number;
  mobilitySessions: number;
  totalMinutes: number;
  sessions: PlanSession[];
}

export type FeasibilityLevel = "ALREADY_THERE" | "COMFORTABLE" | "ACHIEVABLE" | "STRETCH" | "LIMITED_BY_TIME";

export interface Feasibility {
  level: FeasibilityLevel;
  headline: string;
  reasons: string[];
  suggestions: string[];
}

export interface Plan {
  goal: PlanGoal;
  goalLabel: string;
  weeks: number;
  startDate: string;
  endDate: string;
  /** What the goal asks for each week, and what this plan can actually build to. */
  aerobicTarget: number;
  startAerobic: number;
  peakAerobic: number;
  feasibility: Feasibility;
  cautions: string[];
  weeksPlan: PlanWeek[];
  source: { label: string; url: string };
  review: { reviewed: boolean; note: string };
}

// ---- Small helpers ------------------------------------------------------------------

const round5 = (n: number) => Math.round(n / 5) * 5;

export function addDays(isoDay: string, n: number): string {
  return toIsoDay(new Date((dayNumber(isoDay) + n) * 86_400_000));
}

/** ISO weekday of a "YYYY-MM-DD" day: 1 = Monday ... 7 = Sunday. */
export function isoWeekday(isoDay: string): number {
  const d = new Date(`${isoDay}T00:00:00.000Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

/** k well-spaced positions out of n (k is clamped to n), in order. */
function spread(n: number, k: number): number[] {
  const count = Math.min(k, n);
  return Array.from({ length: count }, (_, i) => Math.floor(((i + 0.5) * n) / count));
}

export function ageOn(dateOfBirth: string | null, day: string): number | null {
  if (!dateOfBirth) return null;
  const [by, bm, bd] = dateOfBirth.split("-").map(Number);
  const [y, m, d] = day.split("-").map(Number);
  let age = y - by;
  if (m < bm || (m === bm && d < bd)) age -= 1;
  return age;
}

const nextRamp = (v: number) => round5(v + Math.max(DESIGN_RAMP_MIN_STEP, Math.ceil(v * DESIGN_RAMP_SHARE)));

/** The weekly aerobic targets, week 1 first: start, then the ramp, held at the peak. */
function rampSeries(start: number, peak: number, weeks: number): number[] {
  const series: number[] = [];
  let v = Math.min(start, peak);
  for (let w = 0; w < weeks; w++) {
    series.push(v);
    v = Math.min(peak, nextRamp(v));
  }
  return series;
}

/** Which week (1-based) the ramp first reaches the peak, counting past the plan if it must. */
function weeksToReach(start: number, peak: number): number {
  let v = Math.min(start, peak);
  let w = 1;
  while (v < peak && w < 200) {
    v = Math.min(peak, nextRamp(v));
    w += 1;
  }
  return w;
}

// ---- Choosing activities ------------------------------------------------------------

interface AerobicPick {
  def: ActivityDef;
  key: LevelKey;
  met: number;
  band: Band;
  factor: number;
}

function levelsInBand(def: ActivityDef, band: Band) {
  return levelKeys(def)
    .map((key) => ({ key, level: def.levels[key]! }))
    .filter(({ level }) => bandOf(level.met) === band)
    .sort((a, b) => a.level.met - b.level.met);
}

function eligible(def: ActivityDef, vigorousAllowed: boolean) {
  return levelsInBand(def, "moderate").length > 0 || (vigorousAllowed && levelsInBand(def, "vigorous").length > 0);
}

function aerobicDefs(req: PlanRequest, baseline: PlanBaseline, vigorousAllowed: boolean): ActivityDef[] {
  const byHistory = Object.entries(baseline.minutesByCode)
    .sort((a, b) => b[1] - a[1])
    .map(([code]) => code);
  const defs: ActivityDef[] = [];
  for (const code of [...req.activityCodes, ...byHistory]) {
    const def = activityByCode(code);
    if (def && planKindOf(code) === "AEROBIC" && eligible(def, vigorousAllowed) && !defs.includes(def)) defs.push(def);
    if (defs.length === 3) break;
  }
  return defs.length > 0 ? defs : [activityByCode("walking")!];
}

function pickFor(def: ActivityDef, week: number, weeks: number, progress: boolean): AerobicPick {
  const moderate = levelsInBand(def, "moderate");
  if (moderate.length > 0) {
    // Goals that build intensity move to the firmer end of moderate in the second half.
    const chosen = progress && week > weeks / 2 ? moderate[moderate.length - 1] : moderate[0];
    return { def, key: chosen.key, met: chosen.level.met, band: "moderate", factor: 1 };
  }
  const vigorous = levelsInBand(def, "vigorous")[0];
  return { def, key: vigorous.key, met: vigorous.level.met, band: "vigorous", factor: WHO_VIGOROUS_FACTOR };
}

function strengthPick(baseline: PlanBaseline, older: boolean) {
  const usesWeights = (baseline.minutesByCode["strength-training"] ?? 0) > (baseline.minutesByCode["bodyweight-training"] ?? 0);
  const def = activityByCode(usesWeights ? "strength-training" : "bodyweight-training")!;
  // Older adults and anyone starting out stay at the lightest level the activity has that still counts.
  const key: LevelKey = older || def.code === "strength-training" ? "LOW" : "MODERATE";
  return { def, key };
}

function mobilityPick(baseline: PlanBaseline) {
  const best = (["yoga", "pilates", "stretching"] as const)
    .map((code) => ({ code, minutes: baseline.minutesByCode[code] ?? 0 }))
    .sort((a, b) => b.minutes - a.minutes)[0];
  const def = activityByCode(best.minutes > 0 ? best.code : "yoga")!;
  return { def, key: levelKeys(def)[0] };
}

// ---- Laying out one week ------------------------------------------------------------

interface Slot {
  date: string;
  weekday: number;
  block: { kind: "STRENGTH" | "MOBILITY"; minutes: number } | null;
  /** Minutes left on this day for aerobic activity. */
  remaining: number;
}

interface Layout {
  slots: Slot[];
  strengthWanted: number;
  strengthPlaced: number;
  mobilityWanted: number;
  mobilityPlaced: number;
}

interface Context {
  req: PlanRequest;
  profile: PlanProfile;
  baseline: PlanBaseline;
  older: boolean;
  strengthDays: number;
  mobilityDays: number;
  vigorousAllowed: boolean;
  defs: ActivityDef[];
}

function layoutWeek(week: number, ctx: Context): Layout {
  const { req, baseline } = ctx;
  const rules = GOALS[req.goal];
  const weekStart = addDays(req.startDate, (week - 1) * 7);
  const days = [...req.days].sort((a, b) => a - b);
  const slots: Slot[] = days.map((weekday) => {
    const offset = (weekday - isoWeekday(weekStart) + 7) % 7;
    return { date: addDays(weekStart, offset), weekday, block: null, remaining: req.sessionMinutes };
  });

  const early = week <= DESIGN_STRENGTH_EASE_IN_WEEKS && baseline.strengthPerWeek < ctx.strengthDays;
  const strengthWanted = ctx.strengthDays === 0 ? 0 : early ? Math.min(ctx.strengthDays, Math.max(1, Math.floor(baseline.strengthPerWeek))) : ctx.strengthDays;
  const mobilityWanted = ctx.mobilityDays;

  // The goal's first priority gets days first; whatever doesn't fit is reported, not squeezed in.
  const want = { strength: strengthWanted, mobility: mobilityWanted };
  const placed = { strength: 0, mobility: 0 };
  const minutesFor = { strength: Math.min(early ? DESIGN_STRENGTH_MIN_EARLY : DESIGN_STRENGTH_MIN, req.sessionMinutes), mobility: Math.min(DESIGN_MOBILITY_MIN, req.sessionMinutes) };
  for (const kind of rules.priority) {
    const free = slots.map((s, i) => (s.block ? -1 : i)).filter((i) => i >= 0);
    for (const at of spread(free.length, want[kind]).map((p) => free[p])) {
      slots[at].block = { kind: kind === "strength" ? "STRENGTH" : "MOBILITY", minutes: minutesFor[kind] };
      slots[at].remaining = req.sessionMinutes - minutesFor[kind];
      placed[kind] += 1;
    }
  }
  return { slots, strengthWanted, strengthPlaced: placed.strength, mobilityWanted, mobilityPlaced: placed.mobility };
}

interface Placed {
  slot: Slot;
  pick: AerobicPick;
  minutes: number;
}

/**
 * Puts `target` moderate-equivalent aerobic minutes onto the days with room. It uses the
 * fewest sessions that can hold the target (at least two when the target is big enough
 * to split), spaced through the week, sharing the minutes evenly. `Infinity` asks how
 * much the week could hold at most.
 */
function placeAerobic(slots: Slot[], target: number, picksFor: (i: number) => AerobicPick): { placed: Placed[]; equivalent: number } {
  const open = slots.filter((s) => s.remaining >= DESIGN_MIN_BLOCK);
  if (open.length === 0 || target <= 0) return { placed: [], equivalent: 0 };

  const choose = (count: number) => spread(open.length, count).map((p, i) => ({ slot: open[p], pick: picksFor(i) }));
  const capacityOf = (chosen: { slot: Slot; pick: AerobicPick }[]) => chosen.reduce((sum, c) => sum + c.slot.remaining * c.pick.factor, 0);

  let count = target === Infinity ? open.length : Math.min(open.length, target >= 20 ? 2 : 1);
  let chosen = choose(count);
  while (target !== Infinity && capacityOf(chosen) < target && count < open.length) {
    count += 1;
    chosen = choose(count);
  }

  const minutes = chosen.map(() => 0);
  if (target === Infinity) {
    chosen.forEach((c, i) => (minutes[i] = c.slot.remaining));
  } else {
    // Share the equivalent minutes evenly, letting a day that is short on time hand its share to the others.
    let left = Math.min(target, capacityOf(chosen));
    let pending = chosen.map((_, i) => i);
    while (left > 1e-9 && pending.length > 0) {
      const share = left / pending.reduce((sum, i) => sum + chosen[i].pick.factor, 0);
      const full = pending.filter((i) => minutes[i] + share >= chosen[i].slot.remaining);
      if (full.length === 0) {
        pending.forEach((i) => (minutes[i] += share));
        left = 0;
      } else {
        for (const i of full) {
          left -= (chosen[i].slot.remaining - minutes[i]) * chosen[i].pick.factor;
          minutes[i] = chosen[i].slot.remaining;
        }
        pending = pending.filter((i) => !full.includes(i));
      }
    }
    minutes.forEach((m, i) => (minutes[i] = Math.min(chosen[i].slot.remaining, Math.max(DESIGN_MIN_BLOCK, round5(m)))));

    // Rounding each session to 5 minutes can drift the week's total off its target; nudge sessions by 5 until it's as close as it can get.
    const goal = Math.min(target, capacityOf(chosen));
    const total = () => minutes.reduce((sum, m, i) => sum + m * chosen[i].pick.factor, 0);
    for (let guard = 0; guard < 60; guard++) {
      const diff = goal - total();
      const delta = diff > 0 ? 5 : -5;
      const candidates = minutes
        .map((m, i) => ({ i, next: m + delta }))
        .filter(({ i, next }) => next >= DESIGN_MIN_BLOCK && next <= chosen[i].slot.remaining && Math.abs(diff - delta * chosen[i].pick.factor) < Math.abs(diff));
      if (candidates.length === 0) break;
      // Take from the longest session, or add to the one with the most room.
      const pick = candidates.sort((a, b) => (delta < 0 ? minutes[b.i] - minutes[a.i] : chosen[b.i].slot.remaining - minutes[b.i] - (chosen[a.i].slot.remaining - minutes[a.i])))[0];
      minutes[pick.i] = pick.next;
    }
  }

  const placed = chosen.map((c, i) => ({ ...c, minutes: minutes[i] }));
  return { placed, equivalent: placed.reduce((sum, p) => sum + p.minutes * p.pick.factor, 0) };
}

// ---- The plan ------------------------------------------------------------------------

export function buildPlan(req: PlanRequest, profile: PlanProfile, baseline: PlanBaseline): Plan {
  const rules = GOALS[req.goal];
  const older = profile.age !== null && profile.age >= OLDER_AGE;
  // Hard efforts only for someone with no reason to avoid them: not 65 or over, not pregnant or postpartum, no listed conditions.
  const vigorousAllowed = !older && profile.pregnancy === null && !profile.hasConditions;
  const ctx: Context = {
    req,
    profile,
    baseline,
    older,
    strengthDays: older ? Math.max(rules.strengthDays, WHO_OLDER_BALANCE_STRENGTH_DAYS) : rules.strengthDays,
    mobilityDays: rules.mobilityDays,
    vigorousAllowed,
    defs: aerobicDefs(req, baseline, vigorousAllowed),
  };
  const picksFor = (week: number) => (i: number) => pickFor(ctx.defs[i % ctx.defs.length], week, req.weeks, rules.progressIntensity);

  // What the days she offered can hold once the strength and mobility sessions are in.
  const steady = layoutWeek(req.weeks, ctx);
  const capacity = Math.round(placeAerobic(steady.slots, Infinity, picksFor(req.weeks)).equivalent);
  const peak = Math.min(rules.aerobicTarget, capacity);

  const hasHistory = baseline.hasHistory;
  const rawStart = hasHistory ? Math.max(DESIGN_MIN_START, round5(baseline.aerobicEquivalent * DESIGN_START_ABOVE_BASELINE)) : DESIGN_MIN_START;
  const start = Math.min(rawStart, peak);
  const targets = rampSeries(start, peak, req.weeks);
  const reachedAt = weeksToReach(start, peak);

  const weeksPlan: PlanWeek[] = targets.map((target, i) => {
    const week = i + 1;
    const lay = layoutWeek(week, ctx);
    const { placed, equivalent } = placeAerobic(lay.slots, target, picksFor(week));
    const sessions: PlanSession[] = [];

    for (const p of placed) {
      const level = p.pick.def.levels[p.pick.key]!;
      sessions.push({
        date: p.slot.date,
        weekday: p.slot.weekday,
        kind: "AEROBIC",
        activityCode: p.pick.def.code,
        label: p.pick.def.label,
        intensity: p.pick.key,
        effort: level.label,
        feel: EFFORT_FEEL[p.pick.band],
        minutes: p.minutes,
        caloriesEstimate: caloriesFor(p.pick.def.code, p.pick.key, p.minutes, profile.weightKg),
      });
    }
    for (const slot of lay.slots) {
      if (!slot.block) continue;
      const pick = slot.block.kind === "STRENGTH" ? strengthPick(baseline, older) : mobilityPick(baseline);
      const level = pick.def.levels[pick.key]!;
      sessions.push({
        date: slot.date,
        weekday: slot.weekday,
        kind: slot.block.kind,
        activityCode: pick.def.code,
        label: pick.def.label,
        intensity: pick.key,
        effort: level.label,
        feel: EFFORT_FEEL[bandOf(level.met)],
        minutes: slot.block.minutes,
        caloriesEstimate: caloriesFor(pick.def.code, pick.key, slot.block.minutes, profile.weightKg),
        ...(older && slot.block.kind === "STRENGTH" ? { note: "Add balance work, such as standing on one leg beside a sturdy support." } : {}),
      });
    }
    // Earlier in the day first when a day holds two sessions: strength or mobility, then the aerobic one.
    sessions.sort((a, b) => a.date.localeCompare(b.date) || (a.kind === "AEROBIC" ? 1 : 0) - (b.kind === "AEROBIC" ? 1 : 0));

    const aerobicMinutes = sessions.filter((s) => s.kind === "AEROBIC").reduce((sum, s) => sum + s.minutes, 0);
    const reached = equivalent >= peak && peak > 0;
    const focus = week === 1 ? (start >= peak && hasHistory ? "Keep it going" : "Settle in") : reached ? (week === reachedAt ? (peak < rules.aerobicTarget ? "Reach the most your time allows" : "Reach your target") : "Hold steady") : "Build";
    return {
      week,
      startDate: addDays(req.startDate, i * 7),
      focus,
      aerobicMinutes,
      aerobicEquivalent: Math.round(equivalent),
      strengthSessions: sessions.filter((s) => s.kind === "STRENGTH").length,
      mobilitySessions: sessions.filter((s) => s.kind === "MOBILITY").length,
      totalMinutes: sessions.reduce((sum, s) => sum + s.minutes, 0),
      sessions,
    };
  });

  const finalEquivalent = weeksPlan[weeksPlan.length - 1].aerobicEquivalent;
  const feasibility = assess({ req, rules, capacity, peak, start, reachedAt, finalEquivalent, baseline, steady });

  return {
    goal: req.goal,
    goalLabel: rules.label,
    weeks: req.weeks,
    startDate: req.startDate,
    endDate: addDays(req.startDate, req.weeks * 7 - 1),
    aerobicTarget: rules.aerobicTarget,
    startAerobic: weeksPlan[0].aerobicEquivalent,
    peakAerobic: finalEquivalent,
    feasibility,
    cautions: cautionsFor(profile, older),
    weeksPlan,
    source: PLAN_SOURCE,
    review: REVIEW,
  };
}

function cautionsFor(profile: PlanProfile, older: boolean): string[] {
  const list = [...CAUTION_ALWAYS];
  if (profile.pregnancy === "PREGNANT") list.unshift(CAUTION_PREGNANT);
  else if (profile.pregnancy === "POSTPARTUM") list.unshift(CAUTION_POSTPARTUM);
  if (profile.hasConditions) list.unshift(CAUTION_CONDITIONS);
  if (older) list.push(CAUTION_OLDER);
  if (profile.age === null) list.push(CAUTION_NO_AGE);
  return list;
}

// ---- Feasibility ----------------------------------------------------------------------

function assess(i: {
  req: PlanRequest;
  rules: (typeof GOALS)[PlanGoal];
  capacity: number;
  peak: number;
  start: number;
  reachedAt: number;
  finalEquivalent: number;
  baseline: PlanBaseline;
  steady: Layout;
}): Feasibility {
  const { req, rules, capacity, peak, start, reachedAt, finalEquivalent, baseline, steady } = i;
  const target = rules.aerobicTarget;
  const baselineMinutes = Math.round(baseline.aerobicEquivalent);
  const reasons: string[] = [];
  const suggestions: string[] = [];

  reasons.push(
    baseline.hasHistory
      ? `Over the last ${BASELINE_WEEKS} weeks you logged about ${baselineMinutes} minutes of moderate activity a week, so week 1 starts at ${start}.`
      : `You haven't logged any activity recently, so week 1 starts gently at ${start} minutes. Log your sessions and this plan can fit you better next time.`
  );

  const timeLimited = capacity < target;
  let level: FeasibilityLevel;
  if (timeLimited) level = "LIMITED_BY_TIME";
  else if (baseline.hasHistory && baselineMinutes >= target) level = "ALREADY_THERE";
  else if (reachedAt > req.weeks) level = "STRETCH";
  else if (reachedAt <= Math.ceil(req.weeks * 0.5)) level = "COMFORTABLE";
  else level = "ACHIEVABLE";

  if (timeLimited) {
    const gap = target - capacity;
    reasons.push(
      `With ${req.days.length} day${req.days.length === 1 ? "" : "s"} of ${req.sessionMinutes} minutes, and the strength and mobility sessions in, there is room for about ${capacity} minutes of aerobic activity a week. ${req.goal === "STAMINA" ? "This goal builds toward" : "The goal asks for"} ${target}.`
    );
    const extraDays = Math.max(1, Math.ceil(gap / req.sessionMinutes));
    const perDay = Math.max(5, Math.ceil(gap / Math.max(1, req.days.length) / 5) * 5);
    suggestions.push(`Adding ${extraDays} more day${extraDays === 1 ? "" : "s"}, or ${perDay} more minutes on each day, would close the gap.`);
    suggestions.push("Any amount still counts: the WHO says some activity is better than none.");
    if (baseline.hasHistory && baselineMinutes > capacity) reasons.push(`That is less than the ${baselineMinutes} minutes a week you do now.`);
  }
  if (steady.strengthPlaced < steady.strengthWanted) {
    reasons.push(`Your days fit ${steady.strengthPlaced} of the ${steady.strengthWanted} strength sessions this goal asks for.`);
    suggestions.push("Another day would let a strength session in.");
  }
  if (steady.mobilityPlaced < steady.mobilityWanted) {
    reasons.push(`Your days fit ${steady.mobilityPlaced} of the ${steady.mobilityWanted} balance and mobility sessions this goal asks for.`);
  }

  if (!timeLimited && level !== "ALREADY_THERE") {
    if (reachedAt > req.weeks) {
      reasons.push(`At a gradual pace, building to ${peak} minutes takes about ${reachedAt} weeks. This ${req.weeks}-week plan gets to ${finalEquivalent}, and you can carry on from there.`);
      suggestions.push(`Choose ${reachedAt} weeks to reach ${peak} minutes inside one plan.`);
    } else if (start < peak) {
      reasons.push(`It builds toward ${peak} minutes a week, reaching it in week ${reachedAt}.`);
    }
  }
  if (level === "ALREADY_THERE") reasons.push(`You already do about as much as the ${target}-minute target, so this plan keeps that up and adds the strength and balance sessions.`);
  suggestions.push("If a week feels too hard, repeat it before moving on.");

  const headlines: Record<FeasibilityLevel, string> = {
    ALREADY_THERE: "Within reach now.",
    COMFORTABLE: `Comfortably achievable in ${req.weeks} weeks.`,
    ACHIEVABLE: `Achievable in ${req.weeks} weeks with steady effort.`,
    STRETCH: `A stretch in ${req.weeks} weeks.`,
    LIMITED_BY_TIME: "Limited by the time you've set aside.",
  };
  return { level, headline: headlines[level], reasons, suggestions };
}
