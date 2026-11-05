import { createHmac, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * Anonymous usage counts: what people use, never who.
 *
 * - Each count is a number for a (day, name) pair: "view:sleep" or "sleep_logged" on 2026-11-05. No user id,
 *   address, device or time of day is stored with it.
 * - "Different people active" needs to tell people apart within a day, so each active person is stored as a
 *   one-way hash of their id and a random salt that exists for one day only. At the end of the day the hashes
 *   are counted and deleted together with the salt: afterwards nothing can link a hash to a person, or one day's
 *   hash to the next day's.
 * - Only signed-in women are counted. Staff and the shared demonstration accounts are not, so they can't skew it.
 * - Counting is best effort: it never throws, never delays a request, and nothing depends on it.
 */

export const SCREENS = [
  "dashboard", "cycle", "nutrition", "activity", "sleep", "wellbeing", "habits", "goals",
  "health", "insights", "reports", "messages", "settings", "learn",
] as const;
export type Screen = (typeof SCREENS)[number];

/** Every action that is counted. Anything not listed here is ignored, so a typo can't create a new counter. */
export const ACTIONS = [
  "signup", "sleep_logged", "meal_logged", "water_logged", "activity_logged", "cycle_logged", "mood_logged",
  "goal_created", "habit_created", "habit_ticked", "medication_added", "appointment_added", "dose_recorded",
  "report_generated", "reminders_on",
] as const;
export type Action = (typeof ACTIONS)[number];

const KNOWN = new Set<string>([...ACTIONS, ...SCREENS.map((s) => `view:${s}`), "active_users"]);
const KEEP_DAYS = 400;

export const utcDay = (d = new Date()) => d.toISOString().slice(0, 10);

/** Adds one to a day's counter. Atomic, so two requests at once can't lose a count. */
export async function countEvent(name: string, day = utcDay()): Promise<void> {
  if (!KNOWN.has(name)) return;
  try {
    await prisma.$executeRaw`
      INSERT INTO "UsageCount" ("day", "name", "count") VALUES (${day}, ${name}, 1)
      ON CONFLICT ("day", "name") DO UPDATE SET "count" = "UsageCount"."count" + 1`;
  } catch (err) {
    logger.warn({ err }, "Usage count failed");
  }
}

// The day's salt and the hashes already stored today, kept in memory so a busy person costs one write, not one per request.
let cacheDay = "";
let salt: string | null = null;
let seenToday = new Set<string>();
let rolledFor = "";

async function saltFor(day: string): Promise<string> {
  if (cacheDay === day && salt) return salt;
  await prisma.usageSalt.createMany({ data: [{ day, salt: randomBytes(24).toString("hex") }], skipDuplicates: true });
  const row = await prisma.usageSalt.findUniqueOrThrow({ where: { day } });
  cacheDay = day;
  salt = row.salt;
  seenToday = new Set();
  return row.salt;
}

/** Notes that this person used the app today. Safe to call on every request. */
export async function noteActive(userId: string, day = utcDay()): Promise<void> {
  try {
    // Once per real day, tidy up the days that have ended (a day passed in by a test is not "today").
    if (day === utcDay() && rolledFor !== day) {
      rolledFor = day;
      void rollUp(day);
    }
    const hash = createHmac("sha256", await saltFor(day)).update(userId).digest("hex").slice(0, 32);
    if (seenToday.has(hash)) return;
    seenToday.add(hash);
    await prisma.usageSeen.createMany({ data: [{ day, hash }], skipDuplicates: true });
  } catch (err) {
    logger.warn({ err }, "Usage active-person note failed");
  }
}

/**
 * Turns every finished day's hashes into one number and deletes the hashes and their salt, and drops counts older
 * than about 13 months. Safe to run any time and more than once.
 */
export async function rollUp(today = utcDay()): Promise<void> {
  try {
    const finished = await prisma.usageSeen.groupBy({ by: ["day"], where: { day: { lt: today } }, _count: { _all: true } });
    for (const { day, _count } of finished) {
      await prisma.$executeRaw`
        INSERT INTO "UsageCount" ("day", "name", "count") VALUES (${day}, 'active_users', ${_count._all})
        ON CONFLICT ("day", "name") DO UPDATE SET "count" = GREATEST("UsageCount"."count", ${_count._all})`;
    }
    await prisma.usageSeen.deleteMany({ where: { day: { lt: today } } });
    await prisma.usageSalt.deleteMany({ where: { day: { lt: today } } });
    const cutoff = utcDay(new Date(Date.now() - KEEP_DAYS * 86_400_000));
    await prisma.usageCount.deleteMany({ where: { day: { lt: cutoff } } });
  } catch (err) {
    logger.warn({ err }, "Usage roll-up failed");
  }
}

export interface UsageSummary {
  days: number;
  /** Oldest first, one row per day including quiet ones. */
  daily: { day: string; active: number; signups: number }[];
  /** Total over the whole period, most used first. */
  screens: { name: string; count: number }[];
  actions: { name: string; count: number }[];
}

export async function summary(days: number, now = new Date()): Promise<UsageSummary> {
  const today = utcDay(now);
  await rollUp(today);
  const since = utcDay(new Date(now.getTime() - (days - 1) * 86_400_000));
  const rows = await prisma.usageCount.findMany({ where: { day: { gte: since } } });
  const liveToday = await prisma.usageSeen.count({ where: { day: today } });

  const byDay = new Map<string, { active: number; signups: number }>();
  const totals = new Map<string, number>();
  for (const r of rows) {
    const d = byDay.get(r.day) ?? { active: 0, signups: 0 };
    if (r.name === "active_users") d.active = r.count;
    else if (r.name === "signup") d.signups = r.count;
    byDay.set(r.day, d);
    if (r.name !== "active_users") totals.set(r.name, (totals.get(r.name) ?? 0) + r.count);
  }
  // Today isn't rolled up yet: show the live count.
  const t = byDay.get(today) ?? { active: 0, signups: 0 };
  t.active = Math.max(t.active, liveToday);
  byDay.set(today, t);

  const daily = Array.from({ length: days }, (_, i) => {
    const day = utcDay(new Date(now.getTime() - (days - 1 - i) * 86_400_000));
    return { day, ...(byDay.get(day) ?? { active: 0, signups: 0 }) };
  });
  const list = (prefix: (n: string) => string | null) =>
    [...totals.entries()]
      .map(([name, count]) => ({ name: prefix(name) ?? "", count }))
      .filter((e) => e.name !== "")
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return {
    days,
    daily,
    screens: list((n) => (n.startsWith("view:") ? n.slice(5) : null)),
    actions: list((n) => (n.startsWith("view:") || n === "signup" ? null : n)),
  };
}

/** Forgets the in-memory cache (tests). */
export function resetUsageCache() {
  cacheDay = "";
  salt = null;
  seenToday = new Set();
  rolledFor = "";
}
