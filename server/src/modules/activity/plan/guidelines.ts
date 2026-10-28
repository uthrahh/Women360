/**
 * Everything the activity-plan builder claims about health lives in this one file,
 * so it can be reviewed in one sitting.
 *
 * What is taken from a published guideline, and what is only our own design choice,
 * is kept apart on purpose:
 *
 *  - WHO_* values come from the WHO Guidelines on physical activity and sedentary
 *    behaviour (2020), recommendations for adults aged 18 to 64, adults aged 65 and
 *    over, and pregnant and postpartum women.
 *  - DESIGN_* values are our own conservative choices for how fast to build up. The
 *    WHO says to start with small amounts and increase gradually; it does not give
 *    numbers for "how gradually", so these are ours.
 *
 * REVIEW.reviewed stays false until a clinician or exercise professional has been
 * through this file, and the screen says so while it does.
 */

export const PLAN_SOURCE = {
  label: "WHO Guidelines on physical activity and sedentary behaviour (2020)",
  url: "https://www.who.int/publications/i/item/9789240015128",
};

export const REVIEW = {
  reviewed: false,
  note: "Draft: not yet reviewed by a clinician or an exercise professional.",
};

// ---- WHO ----------------------------------------------------------------------------

/** Adults: at least 150 minutes of moderate aerobic activity a week (150 to 300 for extra benefit). */
export const WHO_AEROBIC_MIN_PER_WEEK = 150;
/** Adults: muscle-strengthening on 2 or more days a week. */
export const WHO_STRENGTH_DAYS = 2;
/** Aged 65 and over: varied activity that emphasises balance and strength on 3 or more days a week. */
export const WHO_OLDER_BALANCE_STRENGTH_DAYS = 3;
/** Vigorous activity counts double toward the aerobic total (75 vigorous minutes = 150 moderate). */
export const WHO_VIGOROUS_FACTOR = 2;
/** The intensity bands, in METs: moderate is 3.0 to under 6.0, vigorous is 6.0 and over. */
export const MODERATE_MET_MIN = 3.0;
export const VIGOROUS_MET_MIN = 6.0;
export const OLDER_AGE = 65;
export const ADULT_AGE = 18;

// ---- Our own design choices --------------------------------------------------------

/** Where a person with no recent activity starts, in moderate-equivalent minutes a week (about three 10-minute walks). */
export const DESIGN_MIN_START = 30;
/** Each week adds the larger of this many minutes or this share of the week before. */
export const DESIGN_RAMP_MIN_STEP = 15;
export const DESIGN_RAMP_SHARE = 0.2;
/** Starting a little above what she already does, never below. */
export const DESIGN_START_ABOVE_BASELINE = 1.1;
/** A session shorter than this isn't worth scheduling. */
export const DESIGN_MIN_BLOCK = 10;
export const DESIGN_STRENGTH_MIN = 20;
export const DESIGN_STRENGTH_MIN_EARLY = 15;
export const DESIGN_MOBILITY_MIN = 15;
/** Weeks before the full number of strength sessions begins, when she isn't already doing them. */
export const DESIGN_STRENGTH_EASE_IN_WEEKS = 2;
/** What counts as "recent" when working out where she is now. */
export const BASELINE_WEEKS = 4;

export type PlanGoal = "HEALTH" | "STRENGTH" | "STAMINA" | "BALANCE" | "STRESS";

export interface GoalRules {
  label: string;
  /** One plain sentence, shown when choosing. */
  description: string;
  /** Moderate-equivalent aerobic minutes a week the plan builds toward. */
  aerobicTarget: number;
  strengthDays: number;
  mobilityDays: number;
  /** Later weeks move to the harder end of moderate effort. */
  progressIntensity: boolean;
  /** Which comes first when her days can't fit everything. */
  priority: ("strength" | "mobility")[];
}

export const GOALS: Record<PlanGoal, GoalRules> = {
  HEALTH: {
    label: "Stay active for my health",
    description: "The weekly amount the WHO recommends for adults: 150 minutes of moderate activity and 2 strength sessions.",
    aerobicTarget: WHO_AEROBIC_MIN_PER_WEEK,
    strengthDays: WHO_STRENGTH_DAYS,
    mobilityDays: 0,
    progressIntensity: false,
    priority: ["strength", "mobility"],
  },
  STRENGTH: {
    label: "Get stronger",
    description: "Three strength sessions a week, with enough walking or cycling alongside to meet the WHO minimum.",
    aerobicTarget: WHO_AEROBIC_MIN_PER_WEEK,
    strengthDays: 3,
    mobilityDays: 0,
    progressIntensity: false,
    priority: ["strength", "mobility"],
  },
  STAMINA: {
    label: "Build stamina",
    description: "More aerobic time than the minimum, and a firmer pace in the later weeks, with 2 strength sessions.",
    aerobicTarget: 225,
    strengthDays: WHO_STRENGTH_DAYS,
    mobilityDays: 0,
    progressIntensity: true,
    priority: ["strength", "mobility"],
  },
  BALANCE: {
    label: "Improve balance and flexibility",
    description: "Three gentle balance and mobility sessions a week, plus the WHO minimum of walking and 2 strength sessions.",
    aerobicTarget: WHO_AEROBIC_MIN_PER_WEEK,
    strengthDays: WHO_STRENGTH_DAYS,
    mobilityDays: 3,
    progressIntensity: false,
    priority: ["mobility", "strength"],
  },
  STRESS: {
    label: "Ease stress and feel steadier",
    description: "Regular moderate movement with yoga or stretching worked in, at an effort that stays comfortable.",
    aerobicTarget: WHO_AEROBIC_MIN_PER_WEEK,
    strengthDays: 1,
    mobilityDays: 2,
    progressIntensity: false,
    priority: ["mobility", "strength"],
  },
};

export const PLAN_GOALS = Object.keys(GOALS) as [PlanGoal, ...PlanGoal[]];

/** How hard each band should feel, in plain words ("the talk test"). */
export const EFFORT_FEEL = {
  light: "You could talk or sing comfortably.",
  moderate: "You can talk, but not sing.",
  vigorous: "You can only say a few words at a time.",
};

export const CAUTION_ALWAYS = [
  "This plan is built from what you've logged and the WHO's general guidance. It isn't medical advice and doesn't know your health history.",
  "Stop and get medical help if you feel chest pain, dizziness or unusual breathlessness. If you have a heart, lung or blood-pressure condition, joint problems, or are recovering from an illness or surgery, check with your doctor before starting.",
];
export const CAUTION_PREGNANT =
  "You've told us you're pregnant. Talk to your doctor or midwife before you start. This plan keeps to moderate effort and never asks for hard exercise.";
export const CAUTION_POSTPARTUM =
  "You've told us you're postpartum. Check with your doctor or midwife about when to start. This plan keeps to moderate effort and never asks for hard exercise.";
export const CAUTION_CONDITIONS =
  "You've listed health conditions in your profile. Check this plan with your doctor. It never asks for hard exercise.";
export const CAUTION_NO_AGE = "Add your date of birth in Settings so the plan can fit your age. Until then it assumes an adult under 65.";
export const CAUTION_OLDER =
  "Because you're 65 or over, strength sessions are paired with balance work (for example standing on one leg beside a sturdy support). Keep something to hold on to.";
