import { prisma } from "@/lib/prisma";
import { chatLimits } from "./chat.config";

export type LimitResult = { ok: true } | { ok: false; reason: "person" | "site"; retry: "hour" | "day" };

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/**
 * Counts one more question against her limits (40 an hour and 150 a day by default) and the whole site's (1,500 a day). Nothing is recorded
 * when a limit is hit. The rows hold only who and when, never any text.
 */
export async function takeChatTurn(userId: string, now = new Date()): Promise<LimitResult> {
  const limits = chatLimits();
  const [hour, day, site] = await Promise.all([
    prisma.chatTurn.count({ where: { userId, createdAt: { gte: new Date(now.getTime() - HOUR) } } }),
    prisma.chatTurn.count({ where: { userId, createdAt: { gte: new Date(now.getTime() - DAY) } } }),
    prisma.chatTurn.count({ where: { createdAt: { gte: new Date(now.getTime() - DAY) } } }),
  ]);
  if (hour >= limits.perHour) return { ok: false, reason: "person", retry: "hour" };
  if (day >= limits.perDay) return { ok: false, reason: "person", retry: "day" };
  if (site >= limits.siteDay) return { ok: false, reason: "site", retry: "day" };
  await prisma.chatTurn.create({ data: { userId, createdAt: now } });
  return { ok: true };
}

/** Retention: the rows are only needed for a day, so anything older than two days is deleted (part of the daily sweep). */
export async function purgeChatTurns(now = new Date()): Promise<number> {
  const { count } = await prisma.chatTurn.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 2 * DAY) } } });
  return count;
}
