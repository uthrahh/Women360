/**
 * Game mode, worked out from what she logged. Pure: no database, unit-tested.
 *
 * The design is "forgiving": points are only ever earned for looking after herself (logging, ticking a habit, a programme task),
 * never for a number going down or up (weight, calories, fasting, steps counts or amounts earn nothing beyond "you logged it"), and
 * each kind is capped per day so more is not better. Nothing is taken away for a missed day: a run of active days allows one rest
 * day each week, plus up to two freezes earned by every 7 active days, and when a run does end it simply starts again (the best run
 * is kept). Levels and badges only go up while the logs that earned them exist.
 */

export interface DayLog {
  date: string;
  habitsDone: number;
  meals: number;
  water: boolean;
  fruitVeg: boolean;
  sleep: boolean;
  mood: boolean;
  movement: number;
  cycle: boolean;
  medicinesTaken: number;
  programmeTasks: number;
  steps: boolean;
}

export const emptyDay = (date: string): DayLog => ({
  date, habitsDone: 0, meals: 0, water: false, fruitVeg: false, sleep: false, mood: false, movement: 0, cycle: false, medicinesTaken: 0, programmeTasks: 0, steps: false,
});

/** What earns points, how many, and the most that count in one day. Shown to her on the game screen as they are. */
export const POINTS = [
  { key: "habit", label: "A habit done", points: 10, perDay: 5 },
  { key: "sleep", label: "Last night's sleep logged", points: 10, perDay: 1 },
  { key: "mood", label: "A mood check-in", points: 10, perDay: 1 },
  { key: "movement", label: "Movement logged", points: 10, perDay: 2 },
  { key: "programme", label: "A programme task done", points: 10, perDay: 5 },
  { key: "meal", label: "A meal logged", points: 5, perDay: 3 },
  { key: "water", label: "Water logged", points: 5, perDay: 1 },
  { key: "fruitVeg", label: "Fruit or veg logged", points: 5, perDay: 1 },
  { key: "steps", label: "Steps logged", points: 5, perDay: 1 },
  { key: "cycle", label: "Cycle day logged", points: 5, perDay: 1 },
  { key: "medicine", label: "A medicine dose taken", points: 5, perDay: 4 },
] as const;

const capped = (key: (typeof POINTS)[number]["key"], n: number) => {
  const p = POINTS.find((x) => x.key === key)!;
  return Math.min(n, p.perDay) * p.points;
};

export function basePoints(d: DayLog): number {
  return (
    capped("habit", d.habitsDone) +
    capped("sleep", d.sleep ? 1 : 0) +
    capped("mood", d.mood ? 1 : 0) +
    capped("movement", d.movement) +
    capped("programme", d.programmeTasks) +
    capped("meal", d.meals) +
    capped("water", d.water ? 1 : 0) +
    capped("fruitVeg", d.fruitVeg ? 1 : 0) +
    capped("steps", d.steps ? 1 : 0) +
    capped("cycle", d.cycle ? 1 : 0) +
    capped("medicine", d.medicinesTaken)
  );
}

export const isActive = (d: DayLog) => basePoints(d) > 0;

// ---- Daily quests: three small things, the same three all day, chosen from what applies to her -------------------------

export interface QuestDef {
  id: string;
  label: string;
  done: (d: DayLog) => boolean;
  needs?: "cycle" | "habits" | "medicines";
}
export const QUESTS: QuestDef[] = [
  { id: "sleep", label: "Log last night's sleep", done: (d) => d.sleep },
  { id: "mood", label: "Check in on how you feel", done: (d) => d.mood },
  { id: "water", label: "Log some water", done: (d) => d.water },
  { id: "meal", label: "Log a meal", done: (d) => d.meals > 0 },
  { id: "movement", label: "Log some movement", done: (d) => d.movement > 0 },
  { id: "fruitVeg", label: "Log fruit or veg", done: (d) => d.fruitVeg },
  { id: "habit", label: "Tick off a habit", done: (d) => d.habitsDone > 0, needs: "habits" },
  { id: "cycle", label: "Log your cycle day", done: (d) => d.cycle, needs: "cycle" },
  { id: "medicine", label: "Record a medicine dose", done: (d) => d.medicinesTaken > 0, needs: "medicines" },
];
export const QUEST_POINTS = 15;
export const ALL_QUESTS_BONUS = 20;

function hash(s: string): number {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** The day's three quests: fixed for the date (so points never shift), drawn only from what applies to her. */
export function questsFor(date: string, has: { cycle: boolean; habits: boolean; medicines: boolean }): QuestDef[] {
  const pool = QUESTS.filter((q) => !q.needs || has[q.needs]);
  const picked: QuestDef[] = [];
  let seed = hash(date);
  const left = [...pool];
  while (picked.length < 3 && left.length > 0) {
    picked.push(left.splice(seed % left.length, 1)[0]);
    seed = hash(String(seed));
  }
  return picked;
}

export function questPoints(d: DayLog, quests: QuestDef[]): number {
  const done = quests.filter((q) => q.done(d)).length;
  return done * QUEST_POINTS + (quests.length > 0 && done === quests.length ? ALL_QUESTS_BONUS : 0);
}

// ---- Levels -------------------------------------------------------------------------------------------------------------

/** Points needed to reach a level: 0, 100, 300, 600, 1000, ... (each level asks a little more than the last). */
export const pointsForLevel = (level: number) => 50 * level * (level - 1);
export const levelFor = (xp: number) => Math.max(1, Math.floor((1 + Math.sqrt(1 + (4 * Math.max(0, xp)) / 50)) / 2));

// ---- The run of active days ---------------------------------------------------------------------------------------------

const DAY = 86_400_000;
const addDays = (iso: string, n: number) => new Date(Date.parse(iso + "T00:00:00Z") + n * DAY).toISOString().slice(0, 10);
/** Monday of the week the date falls in: rest days are one per Monday-to-Sunday week. */
const weekOf = (iso: string) => addDays(iso, -((new Date(iso + "T00:00:00Z").getUTCDay() + 6) % 7));
export const MAX_FREEZES = 2;

export interface Run {
  current: number;
  best: number;
  freezes: number;
  restLeftThisWeek: boolean;
}

/**
 * Active days in a row, forgivingly. A missed day is covered by the week's rest day if it hasn't been used, otherwise by a freeze
 * (one earned for every 7 active days, at most two kept). Only a missed day nothing covers starts a new run. Today never breaks
 * a run: it isn't over yet.
 */
export function runOf(activeDates: Set<string>, today: string): Run {
  const sorted = [...activeDates].filter((d) => d <= today).sort();
  const run: Run = { current: 0, best: 0, freezes: 0, restLeftThisWeek: true };
  if (sorted.length === 0) return run;
  const restUsed = new Set<string>();
  for (let d = sorted[0]; d <= today; d = addDays(d, 1)) {
    if (activeDates.has(d)) {
      run.current++;
      if (run.current % 7 === 0) run.freezes = Math.min(MAX_FREEZES, run.freezes + 1);
    } else if (d !== today) {
      if (!restUsed.has(weekOf(d))) restUsed.add(weekOf(d));
      else if (run.freezes > 0) run.freezes--;
      else {
        run.current = 0;
        run.freezes = 0;
      }
    }
    run.best = Math.max(run.best, run.current);
  }
  run.restLeftThisWeek = !restUsed.has(weekOf(today));
  return run;
}

// ---- Badges -------------------------------------------------------------------------------------------------------------

export interface Totals {
  activeDays: number;
  habitsDone: number;
  sleepDays: number;
  waterDays: number;
  moodDays: number;
  movementDays: number;
  allRoundDays: number;
  programmeTasks: number;
  bestRun: number;
  level: number;
}

export const BADGES: { id: string; label: string; description: string; earned: (t: Totals) => boolean }[] = [
  { id: "first-day", label: "First step", description: "Logged anything at all", earned: (t) => t.activeDays >= 1 },
  { id: "run-7", label: "A week running", description: "Active 7 days in a row (rest days included)", earned: (t) => t.bestRun >= 7 },
  { id: "run-30", label: "A month running", description: "Active 30 days in a row (rest days included)", earned: (t) => t.bestRun >= 30 },
  { id: "habits-50", label: "Habit builder", description: "50 habits done", earned: (t) => t.habitsDone >= 50 },
  { id: "sleep-14", label: "Sleep diarist", description: "Sleep logged on 14 days", earned: (t) => t.sleepDays >= 14 },
  { id: "water-14", label: "Water watcher", description: "Water logged on 14 days", earned: (t) => t.waterDays >= 14 },
  { id: "mood-14", label: "Checking in", description: "Mood logged on 14 days", earned: (t) => t.moodDays >= 14 },
  { id: "move-14", label: "On the move", description: "Movement logged on 14 days", earned: (t) => t.movementDays >= 14 },
  { id: "all-round", label: "All round", description: "Sleep, a meal, movement and mood logged in one day", earned: (t) => t.allRoundDays >= 1 },
  { id: "programme-10", label: "Plan in action", description: "10 programme tasks done", earned: (t) => t.programmeTasks >= 10 },
  { id: "level-5", label: "Level 5", description: "Reached level 5", earned: (t) => t.level >= 5 },
  { id: "level-10", label: "Level 10", description: "Reached level 10", earned: (t) => t.level >= 10 },
];
