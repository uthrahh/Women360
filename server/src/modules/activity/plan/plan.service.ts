import type { ActivityPlan, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BadRequestError, NotFoundError } from "@/lib/errors";
import { assertPlausibleDay } from "@/lib/days";
import { dayNumber, toIsoDay } from "@/lib/streak";
import { ACTIVITIES, activityByCode, resolveLevel } from "../catalog";
import { latestWeightKg } from "../activity.service";
import { baselineFrom, defaultsFrom, type LoggedEntry } from "./baseline";
import { ADULT_AGE, BASELINE_WEEKS, GOALS, OLDER_AGE, PLAN_GOALS, PLAN_SOURCE, REVIEW, VIGOROUS_MET_MIN, WHO_VIGOROUS_FACTOR } from "./guidelines";
import { PLAN_WEEKS } from "./plan.validation";
import { addDays, ageOn, bandOf, buildPlan, planKindOf, type Plan, type PlanKind, type PlanProfile, type PlanRequest, type PlanSession } from "./planner";

type SessionView = PlanSession & { done: boolean };
type WeekView = Omit<Plan["weeksPlan"][number], "sessions"> & { sessions: SessionView[] };

const dayStart = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** Everything the planner needs about her, read fresh each time so a plan fits her today. */
async function gather(userId: string, startDate: string) {
  const since = dayStart(addDays(startDate, -BASELINE_WEEKS * 7));
  const [user, entries, weightKg] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        dateOfBirth: true,
        reproductiveHealth: { select: { pregnancyStatus: true } },
        healthProfile: { select: { conditions: true } },
      },
    }),
    prisma.activityEntry.findMany({
      where: { userId, date: { gte: since, lte: dayStart(startDate) } },
      select: { activityCode: true, durationMinutes: true, intensity: true, date: true },
    }),
    latestWeightKg(userId),
  ]);

  const status = user.reproductiveHealth?.pregnancyStatus;
  const profile: PlanProfile = {
    age: ageOn(user.dateOfBirth ? toIsoDay(user.dateOfBirth) : null, startDate),
    pregnancy: status === "PREGNANT" || status === "POSTPARTUM" ? status : null,
    hasConditions: (user.healthProfile?.conditions ?? []).some((c) => c.trim().length > 0),
    weightKg,
  };
  if (profile.age !== null && profile.age < ADULT_AGE) {
    throw new BadRequestError("Activity plans are for adults aged 18 and over.");
  }
  return { profile, entries: entries as LoggedEntry[] };
}

export const planService = {
  /** What the form needs: the goals, the activities she can pick from, and where it should start. */
  async options(userId: string, today: string) {
    assertPlausibleDay(today);
    const { profile, entries } = await gather(userId, today);
    const baseline = baselineFrom(entries);
    const defaults = defaultsFrom(entries);
    const canBeHard = (profile.age === null || profile.age < OLDER_AGE) && profile.pregnancy === null && !profile.hasConditions;

    const aerobicActivities = ACTIVITIES.filter((a) => planKindOf(a.code) === "AEROBIC").map((a) => {
      const hasModerate = Object.values(a.levels).some((l) => l && bandOf(l.met) === "moderate");
      return { code: a.code, label: a.label, group: a.group, available: hasModerate || canBeHard };
    });
    return {
      goals: PLAN_GOALS.map((code) => ({ code, label: GOALS[code].label, description: GOALS[code].description })),
      weeksChoices: [...PLAN_WEEKS],
      aerobicActivities,
      defaults: { goal: "HEALTH" as const, weeks: 8 as const, ...defaults },
      baseline: { hasHistory: baseline.hasHistory, aerobicMinutesPerWeek: Math.round(baseline.aerobicEquivalent) },
      pregnancy: profile.pregnancy,
      source: PLAN_SOURCE,
      review: REVIEW,
    };
  },

  /** Builds a plan for her to look at. Nothing is saved. */
  async preview(userId: string, req: PlanRequest): Promise<Plan> {
    assertPlausibleDay(req.startDate);
    const { profile, entries } = await gather(userId, req.startDate);
    return buildPlan(req, profile, baselineFrom(entries));
  },

  /** Saves the plan as her active one. The server rebuilds it from her answers; it never trusts a plan sent by the client. */
  async start(userId: string, req: PlanRequest) {
    const plan = await this.preview(userId, req);
    const row = await prisma.$transaction(async (tx) => {
      await tx.activityPlan.updateMany({ where: { userId, status: "ACTIVE" }, data: { status: "ENDED", endedAt: new Date() } });
      return tx.activityPlan.create({
        data: {
          userId,
          goal: req.goal,
          weeks: req.weeks,
          startDate: dayStart(req.startDate),
          days: req.days,
          sessionMinutes: req.sessionMinutes,
          activityCodes: req.activityCodes,
          plan: plan as unknown as Prisma.InputJsonValue,
        },
      });
    });
    return this.view(userId, row, req.startDate);
  },

  async active(userId: string, today: string) {
    assertPlausibleDay(today);
    const row = await prisma.activityPlan.findFirst({ where: { userId, status: "ACTIVE" }, orderBy: { createdAt: "desc" } });
    return row ? this.view(userId, row, today) : null;
  },

  async end(userId: string, id: string) {
    const { count } = await prisma.activityPlan.updateMany({ where: { id, userId, status: "ACTIVE" }, data: { status: "ENDED", endedAt: new Date() } });
    if (count === 0) throw new NotFoundError("Plan not found.");
  },

  /**
   * The saved plan with her progress against it, worked out now from what she has logged:
   * a planned session is done when she logged that kind of activity on that day, and the
   * week's totals count everything she logged that week, not only the suggested activity.
   */
  async view(userId: string, row: ActivityPlan, today: string) {
    const plan = row.plan as unknown as Plan;
    const start = plan.startDate;
    const daysIn = dayNumber(today) - dayNumber(start);
    const state = daysIn < 0 ? "UPCOMING" : daysIn >= plan.weeks * 7 ? "FINISHED" : "ACTIVE";
    const currentWeek = Math.min(plan.weeks, Math.max(1, Math.floor(daysIn / 7) + 1));

    const entries = await prisma.activityEntry.findMany({
      where: { userId, date: { gte: dayStart(start), lte: dayStart(plan.endDate) } },
      select: { activityCode: true, durationMinutes: true, intensity: true, date: true },
    });
    const logged = entries.map((e) => ({ day: toIsoDay(e.date), kind: planKindOf(e.activityCode), minutes: e.durationMinutes, code: e.activityCode, intensity: e.intensity }));
    const didKindOn = (kind: PlanKind, day: string) => logged.some((l) => l.day === day && l.kind === kind);

    const weeks: WeekView[] = plan.weeksPlan.map((w) => ({
      ...w,
      sessions: w.sessions.map((s) => ({ ...s, done: s.date <= today && didKindOn(s.kind, s.date) })),
    }));

    const weekStart = addDays(start, (currentWeek - 1) * 7);
    const weekEnd = addDays(weekStart, 6);
    const inWeek = logged.filter((l) => l.day >= weekStart && l.day <= weekEnd);
    const aerobicEquivalent = inWeek.reduce((sum, l) => {
      if (l.kind !== "AEROBIC") return sum;
      const def = activityByCode(l.code);
      if (!def) return sum;
      const met = resolveLevel(def, l.intensity).met;
      return sum + (met >= VIGOROUS_MET_MIN ? l.minutes * WHO_VIGOROUS_FACTOR : bandOf(met) === "moderate" ? l.minutes : 0);
    }, 0);

    return {
      id: row.id,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      plan: { ...plan, weeksPlan: weeks },
      progress: {
        state,
        currentWeek,
        weekDone: {
          aerobicEquivalent,
          strengthSessions: new Set(inWeek.filter((l) => l.kind === "STRENGTH").map((l) => l.day)).size,
          mobilitySessions: new Set(inWeek.filter((l) => l.kind === "MOBILITY").map((l) => l.day)).size,
        },
      },
    };
  },
};
