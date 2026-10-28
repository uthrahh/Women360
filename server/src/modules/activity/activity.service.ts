import { Prisma } from "@prisma/client";
import type { Intensity } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { ACTIVITIES, SOURCE, activityByCode, caloriesFor, parseWeightKg, quickLogLabel, resolveLevel, levelKeys, type LevelKey } from "./catalog";

const MAX_QUICK_LOG = 20;

// Copied into a person's own list the first time she opens it. After that the
// list is hers: she can remove any of these and add her own.
const DEFAULT_QUICK_LOG: { activityCode: string; durationMinutes: number; intensity: Intensity }[] = [
  { activityCode: "walking", durationMinutes: 15, intensity: "LOW" },
  { activityCode: "walking", durationMinutes: 30, intensity: "MODERATE" },
  { activityCode: "bodyweight-training", durationMinutes: 20, intensity: "MODERATE" },
  { activityCode: "stretching", durationMinutes: 10, intensity: "LOW" },
  { activityCode: "cycling", durationMinutes: 30, intensity: "MODERATE" },
  { activityCode: "yoga", durationMinutes: 20, intensity: "LOW" },
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Her most recent logged weight in kilograms, or null if she has none (or it can't be read). */
export async function latestWeightKg(userId: string): Promise<number | null> {
  const rows = await prisma.vitalMeasurement.findMany({ where: { userId, type: "WEIGHT" }, orderBy: { date: "desc" }, take: 5 });
  for (const row of rows) {
    const kg = parseWeightKg(row.value);
    if (kg !== null) return kg;
  }
  return null;
}

type EntryRow = { activityCode: string; intensity: Intensity; durationMinutes: number };
const withCalories = <T extends EntryRow>(row: T, weightKg: number | null) => ({
  ...row,
  caloriesBurned: caloriesFor(row.activityCode, row.intensity, row.durationMinutes, weightKg),
});

function definition(code: string) {
  const def = activityByCode(code);
  if (!def) throw new BadRequestError("Choose an activity from the list.");
  return def;
}

/** An activity only has the effort levels the catalog gives it, and only some have distance or sets. */
function assertValidCombination(code: string, intensity: LevelKey, distanceKm: number | null | undefined, sets: number | null | undefined) {
  const def = definition(code);
  if (!levelKeys(def).includes(intensity)) throw new BadRequestError(`${def.label} has no "${intensity.toLowerCase()}" effort level.`);
  if (distanceKm != null && !def.extras.includes("distanceKm")) throw new BadRequestError(`Distance doesn't apply to ${def.label.toLowerCase()}.`);
  if (sets != null && !def.extras.includes("sets")) throw new BadRequestError(`Sets don't apply to ${def.label.toLowerCase()}.`);
  return def;
}

export const activityService = {
  /** The activities she can choose from, with each effort level and where its number comes from. */
  catalog() {
    return {
      source: SOURCE,
      activities: ACTIVITIES.map((a) => ({
        code: a.code,
        label: a.label,
        group: a.group,
        extras: a.extras,
        levels: levelKeys(a).map((k) => ({ key: k, label: a.levels[k]!.label, short: a.levels[k]!.short, met: a.levels[k]!.met })),
      })),
    };
  },

  async getSummary(userId: string) {
    const since = new Date(Date.now() - 7 * 86_400_000);
    const [goal, todaySteps, entries, weekSteps, weightKg] = await Promise.all([
      prisma.activityGoal.findUnique({ where: { userId } }),
      prisma.stepsLog.findFirst({
        where: { userId, date: new Date(new Date().toISOString().slice(0, 10)) },
      }),
      prisma.activityEntry.findMany({ where: { userId }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 20 }),
      prisma.activityEntry.findMany({ where: { userId, date: { gte: since } } }),
      latestWeightKg(userId),
    ]);

    const activeMinutes = weekSteps
      .filter((e) => e.date.toDateString() === new Date().toDateString())
      .reduce((sum, e) => sum + e.durationMinutes, 0);

    const byDay = new Map<string, number>();
    for (const e of weekSteps) {
      const key = DAY_NAMES[e.date.getUTCDay()];
      byDay.set(key, (byDay.get(key) ?? 0) + e.durationMinutes);
    }

    return {
      steps: todaySteps?.steps ?? 0,
      stepsGoal: goal?.stepsGoal ?? 8000,
      activeMinutes,
      activeMinutesGoal: goal?.activeMinutesGoal ?? 45,
      weeklyMinutes: DAY_NAMES.map((day) => ({ day, minutes: byDay.get(day) ?? 0 })),
      // Calories are an estimate from her latest logged weight; null weight means no estimate.
      weightKg,
      entries: entries.map((e) => withCalories(e, weightKg)),
    };
  },

  async addEntry(
    userId: string,
    input: { date: string; activityCode: string; durationMinutes: number; intensity: LevelKey; distanceKm?: number | null; sets?: number | null; notes?: string }
  ) {
    const def = assertValidCombination(input.activityCode, input.intensity, input.distanceKm, input.sets);
    const row = await prisma.activityEntry.create({
      data: {
        userId,
        type: def.label,
        activityCode: input.activityCode,
        durationMinutes: input.durationMinutes,
        intensity: input.intensity,
        distanceKm: input.distanceKm ?? null,
        sets: input.sets ?? null,
        notes: input.notes,
        date: new Date(input.date),
      },
    });
    return withCalories(row, await latestWeightKg(userId));
  },

  async updateEntry(
    userId: string,
    id: string,
    input: { date?: string; activityCode?: string; durationMinutes?: number; intensity?: LevelKey; distanceKm?: number | null; sets?: number | null; notes?: string }
  ) {
    const entry = await prisma.activityEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundError("Activity entry not found.");
    if (entry.userId !== userId) throw new ForbiddenError();

    // Check the result of the edit, not just the part that was sent. Changing the activity
    // drops a distance or sets the new activity doesn't have, rather than refusing the edit.
    const activityCode = input.activityCode ?? entry.activityCode;
    const intensity = input.intensity ?? entry.intensity;
    const def = definition(activityCode);
    const distanceKm = input.distanceKm !== undefined ? input.distanceKm : def.extras.includes("distanceKm") ? entry.distanceKm : null;
    const sets = input.sets !== undefined ? input.sets : def.extras.includes("sets") ? entry.sets : null;
    assertValidCombination(activityCode, intensity, distanceKm, sets);

    const row = await prisma.activityEntry.update({
      where: { id },
      data: {
        activityCode,
        type: def.label,
        intensity,
        distanceKm,
        sets,
        ...(input.durationMinutes !== undefined ? { durationMinutes: input.durationMinutes } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.date ? { date: new Date(input.date) } : {}),
      },
    });
    return withCalories(row, await latestWeightKg(userId));
  },

  async listQuickLog(userId: string) {
    // The flag flips exactly once, so two tabs opening at the same moment can't both copy the defaults.
    const claimed = await prisma.user.updateMany({ where: { id: userId, activityQuickLogSeeded: false }, data: { activityQuickLogSeeded: true } });
    if (claimed.count === 1) {
      await prisma.activityQuickLog.createMany({
        data: DEFAULT_QUICK_LOG.map((d) => {
          const def = activityByCode(d.activityCode)!;
          return { userId, ...d, type: def.label, label: quickLogLabel(def, d.intensity, d.durationMinutes) };
        }),
        skipDuplicates: true,
      });
    }
    const [rows, weightKg] = await Promise.all([
      prisma.activityQuickLog.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
      latestWeightKg(userId),
    ]);
    return rows.map((r) => withCalories(r, weightKg));
  },

  async addQuickLog(userId: string, input: { activityCode: string; durationMinutes: number; intensity: LevelKey }) {
    const def = assertValidCombination(input.activityCode, input.intensity, null, null);
    await activityService.listQuickLog(userId); // make sure defaults were copied before she adds her own
    const count = await prisma.activityQuickLog.count({ where: { userId } });
    if (count >= MAX_QUICK_LOG) throw new BadRequestError(`Your quick log is full (${MAX_QUICK_LOG}). Remove one to add another.`);
    try {
      const row = await prisma.activityQuickLog.create({
        data: { userId, ...input, type: def.label, label: quickLogLabel(def, input.intensity, input.durationMinutes) },
      });
      return withCalories(row, await latestWeightKg(userId));
    } catch (err) {
      // The unique rule catches two requests racing past each other.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictError("That's already in your quick log.");
      }
      throw err;
    }
  },

  async removeQuickLog(userId: string, id: string) {
    const item = await prisma.activityQuickLog.findUnique({ where: { id } });
    if (!item) throw new NotFoundError("Quick log item not found.");
    if (item.userId !== userId) throw new ForbiddenError();
    await prisma.activityQuickLog.delete({ where: { id } });
  },

  async deleteEntry(userId: string, id: string) {
    const entry = await prisma.activityEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundError("Activity entry not found.");
    if (entry.userId !== userId) throw new ForbiddenError();
    await prisma.activityEntry.delete({ where: { id } });
  },

  async logSteps(userId: string, input: { date: string; steps: number }) {
    return prisma.stepsLog.upsert({
      where: { userId_date: { userId, date: new Date(input.date) } },
      create: { userId, date: new Date(input.date), steps: input.steps },
      update: { steps: input.steps },
    });
  },

  async upsertGoal(userId: string, input: { stepsGoal: number; activeMinutesGoal: number }) {
    return prisma.activityGoal.upsert({
      where: { userId },
      create: { userId, ...input },
      update: input,
    });
  },
};

export { resolveLevel };
