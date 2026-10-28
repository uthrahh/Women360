import { prisma } from "@/lib/prisma";
import { assertPlausibleDay } from "@/lib/days";
import { NotFoundError } from "@/lib/errors";
import { dayNumber, toIsoDay } from "@/lib/streak";
import { detectPeriods } from "../cycle/cycle.service";
import { ageOn } from "../activity/plan/planner";
import { CONDITIONS, CONDITION_CODES, DESIGN_DISMISS_DAYS, DESIGN_LOW_ENERGY, REVIEW, SIGNALS, type ConditionCode, type SignalKey } from "./guidelines";
import { evaluateSignals, type PeriodSummary, type Signal } from "./signals";

const DAY_MS = 86_400_000;
const SIGNAL_KEYS = Object.keys(SIGNALS) as SignalKey[];

/** Her periods with what she logged during each, including symptom-only days inside the period. */
async function periodSummaries(userId: string): Promise<PeriodSummary[]> {
  const [entries, profile] = await Promise.all([
    prisma.cycleEntry.findMany({
      where: { userId },
      select: { date: true, isPeriod: true, flow: true, pain: true, energy: true, excludeCycle: true },
      orderBy: { date: "asc" },
      take: 800,
    }),
    prisma.cycleProfile.findUnique({ where: { userId }, select: { averagePeriodLength: true } }),
  ]);
  const usual = Math.max(1, Math.round(profile?.averagePeriodLength ?? 5));
  const detected = detectPeriods(entries.filter((e) => e.isPeriod).map((e) => ({ date: e.date, flow: e.flow, excludeCycle: e.excludeCycle })));

  return detected.map((p) => {
    // She may log only the first day and then only symptoms, so a period covers her usual length
    // from its start (or longer, if she logged more period days), not just the days marked as period.
    const span = Math.max(Math.round((p.end.getTime() - p.start.getTime()) / DAY_MS) + 1, usual);
    const to = new Date(p.start.getTime() + (span - 1) * DAY_MS);
    const during = entries.filter((e) => e.date >= p.start && e.date <= to);
    const pains = during.map((e) => e.pain).filter((v): v is number => v !== null);
    return {
      start: toIsoDay(p.start),
      end: toIsoDay(p.end),
      lengthKnown: p.lengthKnown,
      excludeCycle: p.excludeCycle,
      heavyDays: during.filter((e) => e.flow === "HEAVY").length,
      maxPain: pains.length ? Math.max(...pains) : null,
      lowEnergyDays: during.filter((e) => e.energy !== null && e.energy <= DESIGN_LOW_ENERGY).length,
    };
  });
}

async function gather(userId: string, today: string) {
  const [user, declared, periods, mood] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { dateOfBirth: true, lifeStage: true, reproductiveHealth: { select: { pregnancyStatus: true } } },
    }),
    prisma.userCondition.findMany({ where: { userId }, select: { condition: true } }),
    periodSummaries(userId),
    prisma.wellbeingEntry.findMany({ where: { userId }, select: { date: true, mood: true }, orderBy: { date: "desc" }, take: 400 }),
  ]);
  const status = user.reproductiveHealth?.pregnancyStatus;
  return {
    today,
    age: ageOn(user.dateOfBirth ? toIsoDay(user.dateOfBirth) : null, today),
    lifeStage: user.lifeStage,
    pregnancy: status === "PREGNANT" || status === "POSTPARTUM" ? status : null,
    declared: declared.map((d) => d.condition as ConditionCode),
    periods,
    mood: mood.map((m) => ({ date: toIsoDay(m.date), mood: m.mood })),
  };
}

export const conditionsService = {
  /** Every condition she can tell us about, with the ones she has told us. */
  async list(userId: string) {
    const rows = await prisma.userCondition.findMany({ where: { userId } });
    const declared = new Set(rows.map((r) => r.condition));
    return {
      review: REVIEW,
      conditions: CONDITION_CODES.map((code) => ({ ...CONDITIONS[code], declared: declared.has(code) })),
    };
  },

  /** Replaces the set of conditions she has told us she has. */
  async setDeclared(userId: string, codes: ConditionCode[]) {
    const unique = [...new Set(codes)];
    await prisma.$transaction([
      prisma.userCondition.deleteMany({ where: { userId, condition: { notIn: unique } } }),
      ...unique.map((condition) => prisma.userCondition.upsert({ where: { userId_condition: { userId, condition } }, create: { userId, condition }, update: {} })),
    ]);
    return this.list(userId);
  },

  /**
   * The patterns in her own data worth taking to a doctor, now. The first time a pattern appears
   * she gets one in-app notification; patterns she set aside stay away for a while. Calling this
   * again changes nothing she has already been told.
   */
  async signals(userId: string, today: string) {
    assertPlausibleDay(today);
    const input = await gather(userId, today);
    const found = evaluateSignals(input);

    const states = await prisma.healthSignalState.findMany({ where: { userId } });
    const stateOf = new Map(states.map((s) => [s.key, s]));
    const now = new Date();
    const visible: Signal[] = [];

    for (const signal of found) {
      const state = stateOf.get(signal.key);
      if (!state) {
        await prisma.$transaction([
          prisma.healthSignalState.create({ data: { userId, key: signal.key, notifiedAt: now } }),
          prisma.notification.create({
            data: {
              userId,
              title: "A pattern worth discussing with a doctor",
              detail: `${signal.title}. Open your Cycle page to see your numbers and why.`,
            },
          }),
        ]);
        visible.push(signal);
        continue;
      }
      const away = state.dismissedAt && dayNumber(toIsoDay(now)) - dayNumber(toIsoDay(state.dismissedAt)) < DESIGN_DISMISS_DAYS;
      if (!away) visible.push(signal);
    }
    return { review: REVIEW, today, signals: visible };
  },

  async dismiss(userId: string, key: string) {
    if (!SIGNAL_KEYS.includes(key as SignalKey)) throw new NotFoundError("That pattern isn't one we track.");
    await prisma.healthSignalState.upsert({
      where: { userId_key: { userId, key } },
      create: { userId, key, dismissedAt: new Date() },
      update: { dismissedAt: new Date() },
    });
  },
};
