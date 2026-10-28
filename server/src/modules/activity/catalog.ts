/**
 * The activities the app knows, and how hard each effort level is.
 *
 * Every effort level carries a MET value from the 2011 Compendium of Physical
 * Activities (Ainsworth BE et al., Medicine & Science in Sports & Exercise
 * 2011;43(8):1575-1581), with the Compendium code it was taken from. One MET is
 * about 1 kcal per kilogram of body weight per hour, so
 *
 *     calories = MET x weight in kg x hours
 *
 * which is a population estimate: it does not know her fitness, terrain, heart
 * rate or body composition, and the app presents it as an estimate. These
 * numbers are medical-adjacent claims, so they live in this one file, each tied
 * to its source row. Change them deliberately.
 */

export type LevelKey = "LOW" | "MODERATE" | "HIGH";
/** The extra details an activity can record, beyond how long and how hard. */
export type Extra = "distanceKm" | "sets";

export interface Level {
  /** What she sees when choosing, with the pace or effort spelled out. */
  label: string;
  /** A one-word name used in short labels ("brisk"). */
  short: string;
  met: number;
  /** The 2011 Compendium code this MET value comes from. */
  code: string;
}

export interface ActivityDef {
  code: string;
  label: string;
  group: string;
  extras: Extra[];
  /** Only the levels that make sense for the activity; some have just one. */
  levels: Partial<Record<LevelKey, Level>>;
}

export const SOURCE = {
  label: "2011 Compendium of Physical Activities (Ainsworth et al., Med Sci Sports Exerc 2011;43:1575-81)",
  url: "https://pacompendium.com",
};

const lv = (label: string, short: string, met: number, code: string): Level => ({ label, short, met, code });

export const ACTIVITIES: ActivityDef[] = [
  { code: "walking", label: "Walking", group: "Walking and running", extras: ["distanceKm"], levels: {
    LOW: lv("Easy, about 3.2 km/h", "Easy", 2.8, "17152"),
    MODERATE: lv("Brisk, about 5.6 km/h", "Brisk", 4.3, "17200"),
    HIGH: lv("Very brisk, about 6.4 km/h", "Very brisk", 5.0, "17220"),
  } },
  { code: "running", label: "Running", group: "Walking and running", extras: ["distanceKm"], levels: {
    LOW: lv("Jog, about 8 km/h", "Jog", 8.3, "12030"),
    MODERATE: lv("Steady run, about 9.7 km/h", "Steady", 9.8, "12050"),
    HIGH: lv("Fast run, about 11.3 km/h", "Fast", 11.0, "12070"),
  } },
  { code: "hiking", label: "Hiking", group: "Walking and running", extras: ["distanceKm"], levels: {
    MODERATE: lv("Cross-country hiking", "Hiking", 6.0, "17080"),
  } },

  { code: "cycling", label: "Cycling", group: "Cycling", extras: ["distanceKm"], levels: {
    LOW: lv("Leisurely, under 16 km/h", "Leisurely", 4.0, "01010"),
    MODERATE: lv("Moderate, 16 to 19 km/h", "Moderate", 6.8, "01020"),
    HIGH: lv("Fast, 19 to 22 km/h", "Fast", 8.0, "01030"),
  } },
  { code: "exercise-bike", label: "Exercise bike", group: "Cycling", extras: [], levels: {
    LOW: lv("Light, 30 to 50 watts", "Light", 3.5, "02011"),
    MODERATE: lv("Moderate, 51 to 89 watts", "Moderate", 4.8, "02017"),
    HIGH: lv("Hard, 90 to 100 watts", "Hard", 6.8, "02012"),
  } },

  { code: "swimming", label: "Swimming", group: "Water", extras: ["distanceKm"], levels: {
    LOW: lv("Slow laps, light effort", "Slow", 5.8, "18240"),
    MODERATE: lv("Medium-speed laps", "Medium", 8.3, "18290"),
    HIGH: lv("Fast laps, vigorous effort", "Fast", 9.8, "18230"),
  } },

  { code: "yoga", label: "Yoga", group: "Mind and body", extras: [], levels: {
    LOW: lv("Gentle (Hatha)", "Gentle", 2.5, "02150"),
    MODERATE: lv("Flowing (Surya Namaskar)", "Flowing", 3.3, "02180"),
    HIGH: lv("Power yoga", "Power", 4.0, "02160"),
  } },
  { code: "pilates", label: "Pilates", group: "Mind and body", extras: [], levels: {
    MODERATE: lv("Pilates, general", "Pilates", 3.0, "02105"),
  } },
  { code: "stretching", label: "Stretching", group: "Mind and body", extras: [], levels: {
    LOW: lv("Mild stretching", "Mild", 2.3, "02101"),
  } },

  { code: "strength-training", label: "Strength training (weights)", group: "Strength and conditioning", extras: ["sets"], levels: {
    LOW: lv("Light to moderate, 8 to 15 reps", "Light", 3.5, "02054"),
    HIGH: lv("Vigorous, heavy lifting", "Heavy", 6.0, "02050"),
  } },
  { code: "bodyweight-training", label: "Bodyweight training", group: "Strength and conditioning", extras: ["sets"], levels: {
    LOW: lv("Light, such as sit-ups and crunches", "Light", 2.8, "02024"),
    MODERATE: lv("Moderate, such as push-ups and lunges", "Moderate", 3.8, "02022"),
    HIGH: lv("Vigorous, such as jumping jacks and pull-ups", "Vigorous", 8.0, "02020"),
  } },
  { code: "circuit-training", label: "Circuit training", group: "Strength and conditioning", extras: [], levels: {
    MODERATE: lv("Moderate effort", "Moderate", 4.3, "02035"),
    HIGH: lv("Vigorous, with kettlebells", "Vigorous", 8.0, "02040"),
  } },
  { code: "rowing-machine", label: "Rowing machine", group: "Strength and conditioning", extras: [], levels: {
    MODERATE: lv("Moderate effort", "Moderate", 4.8, "02071"),
    HIGH: lv("Vigorous effort", "Vigorous", 6.0, "02070"),
  } },
  { code: "elliptical", label: "Elliptical trainer", group: "Strength and conditioning", extras: [], levels: {
    MODERATE: lv("Moderate effort", "Moderate", 5.0, "02048"),
  } },
  { code: "skipping-rope", label: "Skipping rope", group: "Strength and conditioning", extras: [], levels: {
    LOW: lv("Slow, under 100 skips a minute", "Slow", 8.8, "15552"),
    MODERATE: lv("Moderate, 100 to 120 skips a minute", "Moderate", 11.8, "15551"),
    HIGH: lv("Fast, 120 to 160 skips a minute", "Fast", 12.3, "15550"),
  } },

  { code: "dance-aerobics", label: "Aerobic dance", group: "Dance", extras: [], levels: {
    LOW: lv("Low-impact aerobics", "Low impact", 5.0, "03020"),
    HIGH: lv("High-impact aerobics", "High impact", 7.3, "03021"),
  } },

  { code: "badminton", label: "Badminton", group: "Sports", extras: [], levels: {
    MODERATE: lv("Social singles or doubles", "Social", 5.5, "15030"),
  } },
  { code: "tennis", label: "Tennis", group: "Sports", extras: [], levels: {
    MODERATE: lv("General play", "General", 7.3, "15675"),
  } },
  { code: "basketball", label: "Basketball", group: "Sports", extras: [], levels: {
    LOW: lv("Shooting baskets", "Shooting", 4.5, "15070"),
    MODERATE: lv("General play", "General", 6.5, "15055"),
  } },
  { code: "football", label: "Football (soccer)", group: "Sports", extras: [], levels: {
    MODERATE: lv("Casual game", "Casual", 7.0, "15610"),
  } },
  { code: "table-tennis", label: "Table tennis", group: "Sports", extras: [], levels: {
    MODERATE: lv("General play", "General", 4.0, "15660"),
  } },

  { code: "housework", label: "Housework", group: "Everyday", extras: [], levels: {
    LOW: lv("General, light effort", "Light", 2.5, "05040"),
    MODERATE: lv("Heavy cleaning", "Heavy", 3.5, "05020"),
  } },
  { code: "gardening", label: "Gardening", group: "Everyday", extras: [], levels: {
    MODERATE: lv("General, moderate effort", "Moderate", 3.8, "08245"),
  } },
];

export const ACTIVITY_CODES = ACTIVITIES.map((a) => a.code) as [string, ...string[]];
const BY_CODE = new Map(ACTIVITIES.map((a) => [a.code, a]));
const ORDER: LevelKey[] = ["LOW", "MODERATE", "HIGH"];

export const activityByCode = (code: string): ActivityDef | undefined => BY_CODE.get(code);
export const levelKeys = (def: ActivityDef): LevelKey[] => ORDER.filter((k) => def.levels[k]);

/**
 * The effort level to use: the one asked for if the activity has it, otherwise the
 * closest one it does have. (Older entries were logged before each activity had its
 * own levels, so an "easy pilates" can exist; it is counted as the one pilates level.)
 */
export function resolveLevel(def: ActivityDef, intensity: LevelKey): Level {
  const exact = def.levels[intensity];
  if (exact) return exact;
  const keys = levelKeys(def);
  const want = ORDER.indexOf(intensity);
  const nearest = keys.reduce((best, k) => (Math.abs(ORDER.indexOf(k) - want) < Math.abs(ORDER.indexOf(best) - want) ? k : best), keys[0]);
  return def.levels[nearest]!;
}

/** Whole calories for one session, or null when the activity is unknown or her weight is. */
export function caloriesFor(code: string, intensity: LevelKey, minutes: number, weightKg: number | null): number | null {
  const def = activityByCode(code);
  if (!def || weightKg === null || !(weightKg > 0) || !(minutes > 0)) return null;
  return Math.round(resolveLevel(def, intensity).met * weightKg * (minutes / 60));
}

/** "30 min", "1 h", "1 h 5 min". */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** The quick-log chip text: "30 min walking, brisk" (the effort is left out when there is only one). */
export function quickLogLabel(def: ActivityDef, intensity: LevelKey, minutes: number): string {
  const level = resolveLevel(def, intensity);
  const many = levelKeys(def).length > 1;
  return `${formatDuration(minutes)} ${def.label.toLowerCase()}${many ? `, ${level.short.toLowerCase()}` : ""}`;
}

/** A logged weight is free text ("63.4 kg", "140 lb", "63"); kilograms are assumed when no unit is given. */
export function parseWeightKg(value: string): number | null {
  const match = value.trim().toLowerCase().match(/^(\d+(?:[.,]\d+)?)\s*(kg|kgs|kilograms?|lb|lbs|pounds?)?$/);
  if (!match) return null;
  const n = Number(match[1].replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  const kg = match[2] && /^(lb|pound)/.test(match[2]) ? n * 0.45359237 : n;
  return kg >= 20 && kg <= 400 ? Math.round(kg * 10) / 10 : null;
}
