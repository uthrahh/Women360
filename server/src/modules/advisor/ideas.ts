/**
 * The health advisor's own ideas: small preventive habits and check-ups, worked out from her logs. Pure, so it is unit-tested.
 *
 * Every idea is measured only against her own numbers: the goals and targets she set (or the app's goal she sees every day), and
 * her own earlier weeks. No outside guideline figure, risk statement or diagnosis is used or implied; each idea says why it was
 * suggested, in her numbers, and is something she can do in a few minutes. Ideas she already has as a habit, or said no to, are left
 * out. The fit (0 to 100) is how far she is from her own goal, and decides the order.
 */

export interface AdvisorInput {
  cycleTracking: boolean;
  /** Titles of her current habits and open goals, lower-cased. */
  existing: string[];
  dismissed: string[];
  waterGoalMl: number;
  waterDaysLogged7: number;
  waterDaysMet7: number;
  fruitVegGoal: number;
  fruitVegDaysLogged7: number;
  fruitVegDaysMet7: number;
  activityTargets: { label: string; minutes: number; period: "DAY" | "WEEK"; done: number }[];
  activeDays7: number;
  activeDaysEarlier: number;
  sleepNights7: number;
  sleepQuality7: number | null;
  sleepHours7: number | null;
  sleepHoursEarlier: number | null;
  moodDays7: number;
  mood7: number | null;
  stress7: number | null;
  medicines: number;
  medicineDosesMissed7: number;
  lastAppointmentDaysAgo: number | null;
  /** Days into the current week, Monday = 1. Weekly targets are judged against how much of the week has gone. */
  weekDay: number;
}

export type IdeaAction =
  | { type: "habit"; title: string; daysPerWeek: number; target?: number | null; unit?: string | null }
  | { type: "goal"; title: string; category: "PREVENTIVE" | "OTHER" };

export interface Idea {
  key: string;
  area: "water" | "food" | "movement" | "sleep" | "wellbeing" | "medicines" | "check-up";
  title: string;
  why: string;
  fit: number;
  action: IdeaAction;
  source: "logs" | "ai";
}

const pct = (n: number) => Math.round(Math.max(0, Math.min(100, n)));
const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

export function ideasFor(i: AdvisorInput): Idea[] {
  const out: Idea[] = [];
  const add = (idea: Omit<Idea, "source">) => out.push({ ...idea, source: "logs" });

  if (i.waterDaysLogged7 >= 3 && i.waterDaysMet7 <= 4) {
    add({
      key: "water-meals",
      area: "water",
      title: "A glass of water with each meal",
      why: `You reached your water goal (${i.waterGoalMl.toLocaleString()} ml) on ${i.waterDaysMet7} of the last 7 days.`,
      fit: pct(((7 - i.waterDaysMet7) / 7) * 100),
      action: { type: "habit", title: "A glass of water with each meal", daysPerWeek: 7 },
    });
  }

  if (i.fruitVegDaysLogged7 >= 3 && i.fruitVegDaysMet7 <= 3) {
    add({
      key: "veg-lunch",
      area: "food",
      title: "Add a vegetable to lunch",
      why: `You reached your fruit and veg goal (${i.fruitVegGoal} a day) on ${i.fruitVegDaysMet7} of the last 7 days.`,
      fit: pct(((7 - i.fruitVegDaysMet7) / 7) * 90),
      action: { type: "habit", title: "Add a vegetable to lunch", daysPerWeek: 7 },
    });
  }

  // A movement target she set that is behind for this point in the week (or the day).
  for (const t of i.activityTargets) {
    const expected = t.period === "DAY" ? t.minutes : (t.minutes * i.weekDay) / 7;
    if (expected <= 0 || t.done >= expected * 0.7) continue;
    add({
      key: `move-${t.label.toLowerCase().replace(/\W+/g, "-")}`,
      area: "movement",
      title: `10 minutes of ${t.label.toLowerCase()} after a meal`,
      why: `${t.done} of your ${t.minutes}-minute ${t.label.toLowerCase()} target ${t.period === "DAY" ? "today" : "this week"} so far.`,
      fit: pct((1 - t.done / expected) * 100),
      action: { type: "habit", title: `10 minutes of ${t.label.toLowerCase()} after a meal`, daysPerWeek: 5, target: 10, unit: "minutes" },
    });
  }
  if (i.activityTargets.length === 0 && i.activeDays7 <= 1 && i.activeDaysEarlier >= 3) {
    add({
      key: "move-10",
      area: "movement",
      title: "Move for 10 minutes",
      why: `You logged movement on ${plural(i.activeDays7, "day")} this week, fewer than in your earlier weeks.`,
      fit: 70,
      action: { type: "habit", title: "Move for 10 minutes", daysPerWeek: 3, target: 10, unit: "minutes" },
    });
  }

  if (i.sleepNights7 >= 3 && i.sleepQuality7 !== null && i.sleepQuality7 <= 2.5) {
    add({
      key: "sleep-phone",
      area: "sleep",
      title: "Phone out of the bedroom at night",
      why: `You rated your sleep ${i.sleepQuality7} of 5 on average over ${plural(i.sleepNights7, "night")} this week.`,
      fit: pct(((5 - i.sleepQuality7) / 4) * 100),
      action: { type: "habit", title: "Phone out of the bedroom at night", daysPerWeek: 7 },
    });
  }
  if (i.sleepHours7 !== null && i.sleepHoursEarlier !== null && i.sleepNights7 >= 3 && i.sleepHoursEarlier - i.sleepHours7 >= 0.75) {
    add({
      key: "sleep-winddown",
      area: "sleep",
      title: "Start winding down 30 minutes before bed",
      why: `You slept ${i.sleepHours7} hours a night this week, against ${i.sleepHoursEarlier} in your earlier weeks.`,
      fit: pct((i.sleepHoursEarlier - i.sleepHours7) * 60),
      action: { type: "habit", title: "Start winding down 30 minutes before bed", daysPerWeek: 7 },
    });
  }

  // Mood is 0 (lowest) to 4; stress 0 to 4.
  if (i.moodDays7 >= 3 && ((i.mood7 !== null && i.mood7 <= 1.5) || (i.stress7 !== null && i.stress7 >= 3))) {
    add({
      key: "breathing",
      area: "wellbeing",
      title: "Five minutes of slow breathing",
      why:
        i.mood7 !== null && i.mood7 <= 1.5
          ? `Your mood averaged ${i.mood7} of 4 over ${plural(i.moodDays7, "check-in")} this week.`
          : `Your stress averaged ${i.stress7} of 4 over ${plural(i.moodDays7, "check-in")} this week.`,
      fit: 75,
      action: { type: "habit", title: "Five minutes of slow breathing", daysPerWeek: 7, target: 5, unit: "minutes" },
    });
  }

  if (i.medicines > 0 && i.medicineDosesMissed7 >= 2) {
    add({
      key: "meds-evening",
      area: "medicines",
      title: "Set out tomorrow's medicines each evening",
      why: `${plural(i.medicineDosesMissed7, "dose")} this week were marked skipped.`,
      fit: pct(i.medicineDosesMissed7 * 15),
      action: { type: "habit", title: "Set out tomorrow's medicines each evening", daysPerWeek: 7 },
    });
  }

  if (i.lastAppointmentDaysAgo === null || i.lastAppointmentDaysAgo > 365) {
    add({
      key: "checkup",
      area: "check-up",
      title: "Book a routine check-up",
      why: i.lastAppointmentDaysAgo === null ? "There's no appointment in your records." : "Your last recorded appointment was over a year ago.",
      fit: 55,
      action: { type: "goal", title: "Book a routine check-up", category: "PREVENTIVE" },
    });
  }

  const have = new Set(i.existing.map((t) => t.toLowerCase().trim()));
  const no = new Set(i.dismissed);
  return out
    .filter((x) => !no.has(x.key) && !have.has(x.action.title.toLowerCase()))
    .sort((a, b) => b.fit - a.fit)
    .slice(0, 6);
}

/**
 * Words an AI idea must not contain: the advisor suggests everyday self-care only, never a diagnosis, a treatment, a medicine or
 * supplement, a dose, fasting, or a weight or calorie target. An idea that trips this is dropped, not rewritten.
 */
export const FORBIDDEN = /\b(diagnos\w*|cure\w*|treat(ment|s|ing)?|prescri\w*|dose|dosage|mg|supplement\w*|medicat\w*|pill\w*|drug\w*|fast(ing)?|calori\w*|weight[- ]?loss|lose weight|diet pill|detox|cancer|diabet\w*|disease)\b/i;
