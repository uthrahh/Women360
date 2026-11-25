import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { TooManyRequestsError } from "@/lib/errors";
import { activityService } from "@/modules/activity/activity.service";
import { buildSummary } from "@/modules/chat/chat.summary";
import { chatConfigured, chatEnabled, chatProvider } from "@/modules/chat/chat.config";
import { takeChatTurn } from "@/modules/chat/chat.limits";
import { ideasFor, type AdvisorInput, type Idea } from "./ideas";
import { aiIdeas, scriptedIdeas, type AdvisorClient } from "./advisor.ai";

/** A dismissed idea stays away this long; the daily sweep deletes older rows. */
export const DISMISS_DAYS = 90;
const DAY = 86_400_000;
const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);

let client: Anthropic | null = null;
const anthropic = (): AdvisorClient => (client ??= new Anthropic({ timeout: 60_000, maxRetries: 2 })) as unknown as AdvisorClient;

async function existingTitles(userId: string) {
  const [habits, goals] = await Promise.all([
    prisma.habit.findMany({ where: { userId, archivedAt: null }, select: { title: true } }),
    prisma.goal.findMany({ where: { userId, completed: false }, select: { title: true } }),
  ]);
  return [...habits, ...goals].map((x) => x.title.toLowerCase());
}

/** Her own numbers for the last 7 days (and the 3 weeks before, for comparison), read from her logs. */
async function inputFor(userId: string, today: string): Promise<AdvisorInput> {
  const end = new Date(today + "T00:00:00Z");
  const from7 = new Date(end.getTime() - 6 * DAY);
  const from28 = new Date(end.getTime() - 27 * DAY);
  const since = (from: Date) => ({ gte: from, lte: end });
  const [user, goal, water, fruit, activity, sleep, mood, meds, missed, lastAppt, dismissed, existing, targets] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { cycleTracking: true } }),
    prisma.nutritionGoal.findUnique({ where: { userId } }),
    prisma.hydrationLog.groupBy({ by: ["date"], where: { userId, date: since(from7) }, _sum: { amountMl: true } }),
    prisma.fruitVegLog.groupBy({ by: ["date"], where: { userId, date: since(from7) }, _sum: { servings: true } }),
    prisma.activityEntry.groupBy({ by: ["date"], where: { userId, date: since(from28) } }),
    prisma.sleepEntry.findMany({ where: { userId, date: since(from28) }, select: { date: true, durationHours: true, quality: true } }),
    prisma.wellbeingEntry.findMany({ where: { userId, date: since(from7) }, select: { mood: true, stress: true } }),
    prisma.medication.count({ where: { userId } }),
    prisma.medicationLog.count({ where: { userId, status: "SKIPPED", scheduledFor: { gte: from7 } } }),
    prisma.appointment.findFirst({ where: { userId, date: { lte: end } }, orderBy: { date: "desc" }, select: { date: true } }),
    prisma.advisorDismissal.findMany({ where: { userId, createdAt: { gte: new Date(Date.now() - DISMISS_DAYS * DAY) } }, select: { key: true } }),
    existingTitles(userId),
    activityService.getTargets(userId, today),
  ]);
  const waterGoalMl = goal?.hydrationGoalMl ?? 2200;
  const fruitVegGoal = goal?.fruitVegGoal ?? 5;
  const recent = (d: Date) => d >= from7;
  const sleep7 = sleep.filter((s) => recent(s.date));
  const sleepEarlier = sleep.filter((s) => !recent(s.date));
  return {
    cycleTracking: user.cycleTracking,
    existing,
    dismissed: dismissed.map((d) => d.key),
    waterGoalMl,
    waterDaysLogged7: water.length,
    waterDaysMet7: water.filter((w) => (w._sum.amountMl ?? 0) >= waterGoalMl).length,
    fruitVegGoal,
    fruitVegDaysLogged7: fruit.length,
    fruitVegDaysMet7: fruit.filter((f) => (f._sum.servings ?? 0) >= fruitVegGoal).length,
    activityTargets: targets.targets.map((t) => ({ label: t.label, minutes: t.minutes, period: t.period, done: t.done })),
    activeDays7: activity.filter((a) => recent(a.date)).length,
    activeDaysEarlier: activity.filter((a) => !recent(a.date)).length,
    sleepNights7: sleep7.length,
    sleepQuality7: avg(sleep7.map((s) => s.quality)),
    sleepHours7: avg(sleep7.map((s) => s.durationHours)),
    sleepHoursEarlier: sleepEarlier.length >= 3 ? avg(sleepEarlier.map((s) => s.durationHours)) : null,
    moodDays7: mood.length,
    mood7: avg(mood.map((m) => m.mood)),
    stress7: avg(mood.filter((m) => m.stress !== null).map((m) => m.stress!)),
    medicines: meds,
    medicineDosesMissed7: missed,
    lastAppointmentDaysAgo: lastAppt ? Math.round((end.getTime() - lastAppt.date.getTime()) / DAY) : null,
    weekDay: ((end.getUTCDay() + 6) % 7) + 1,
  };
}

export const advisorService = {
  /** Ideas from her own logs, and whether the AI advisor is available to her. */
  async ideas(userId: string, isDemo: boolean, today: string) {
    const input = await inputFor(userId, today);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { chatShareConsentAt: true } });
    return {
      ideas: ideasFor(input),
      ai: { available: chatEnabled() && chatConfigured() && !isDemo, sharing: user.chatShareConsentAt !== null },
    };
  },

  /**
   * More personal ideas from the AI advisor. Only when the chat is switched on, she agreed to share the numbers-only summary, and she
   * has questions left today (it counts as a chat question). Nothing it says is stored.
   */
  async aiIdeas(userId: string, today: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { chatShareConsentAt: true } });
    if (user.chatShareConsentAt === null) return { ideas: [], needsSharing: true };
    const turn = await takeChatTurn(userId);
    if (!turn.ok) throw new TooManyRequestsError("You've used today's AI questions. Please try again tomorrow.");
    const [existing, dismissed] = await Promise.all([
      existingTitles(userId),
      prisma.advisorDismissal.findMany({ where: { userId }, select: { key: true } }),
    ]);
    const no = new Set(dismissed.map((d) => d.key));
    const ideas = chatProvider() === "scripted" ? scriptedIdeas(existing) : await aiIdeas(anthropic(), await buildSummary(userId, today), existing);
    return { ideas: ideas.filter((i: Idea) => !no.has(i.key)), needsSharing: false };
  },

  async dismiss(userId: string, key: string) {
    await prisma.advisorDismissal.upsert({ where: { userId_key: { userId, key } }, create: { userId, key }, update: { createdAt: new Date() } });
    return { ok: true };
  },
};

export async function purgeOldAdvisorDismissals(now = new Date()): Promise<number> {
  const res = await prisma.advisorDismissal.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - DISMISS_DAYS * DAY) } } });
  return res.count;
}

