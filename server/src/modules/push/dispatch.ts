import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { habitsService } from "@/modules/habits/habits.service";
import { inWindow, localClock, parseReminder, parseTimeOfDay } from "./schedule";
import type { PushPayload, Sender } from "./sender";

/** A recorded dose within this long before a dose time counts as that dose, so a medicine she already took doesn't nag. */
const DOSE_LOOKBACK_MINUTES = 180;
/** The dedupe rows are only needed for the day in question. */
const KEEP_SENT_DAYS = 3;

interface Due {
  kind: "habit" | "medication";
  refId: string;
  slot: string;
  payload: PushPayload;
}

export interface TickResult {
  people: number;
  sent: number;
  removedDevices: number;
}

/**
 * Sends the reminders that are due right now to the devices of the people who allowed them. Called every
 * minute by the server. Safe to call more often or from two servers: each reminder is claimed in the
 * database first (one row per item per day), so it is sent once.
 *
 * What it will not do: remind about something already done (a habit ticked, a dose recorded), remind about
 * an "N days a week" habit whose week is already met, send a reminder more than 20 minutes late, or put the
 * habit's or medicine's name on a lock screen (the text is generic; the details are one tap away).
 */
export async function runReminderTick(now: Date, send: Sender): Promise<TickResult> {
  const result: TickResult = { people: 0, sent: 0, removedDevices: 0 };

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { user: { deletedAt: null } },
    orderBy: { updatedAt: "desc" },
  });
  const byUser = new Map<string, typeof subscriptions>();
  for (const s of subscriptions) byUser.set(s.userId, [...(byUser.get(s.userId) ?? []), s]);

  for (const [userId, devices] of byUser) {
    result.people += 1;
    // Her most recently used device decides which clock "7:00 AM" is read on.
    const clock = localClock(now, devices[0].timezone);
    const due = await dueFor(userId, clock, now);
    for (const item of due) {
      const claimed = await claim(userId, item, clock.day);
      if (!claimed) continue;
      let delivered = false;
      for (const device of devices) {
        const outcome = await send({ endpoint: device.endpoint, p256dh: device.p256dh, auth: device.auth }, item.payload);
        if (outcome === "sent") {
          delivered = true;
          result.sent += 1;
        } else if (outcome === "gone") {
          await prisma.pushSubscription.deleteMany({ where: { id: device.id } });
          result.removedDevices += 1;
        }
      }
      // Nothing got through (a push service hiccup): give the claim back so the next tick can try again.
      if (!delivered) await unclaim(userId, item, clock.day);
    }
  }
  return result;
}

async function dueFor(userId: string, clock: { day: string; minutes: number }, now: Date): Promise<Due[]> {
  const due: Due[] = [];

  const habits = await habitsService.list(userId, clock.day);
  for (const habit of habits) {
    const at = parseReminder(habit.reminder);
    if (at === null || !inWindow(clock.minutes, at)) continue;
    if (habit.doneToday) continue;
    if (habit.daysPerWeek < 7 && habit.thisWeek >= habit.daysPerWeek) continue;
    due.push({
      kind: "habit",
      refId: habit.id,
      slot: String(at),
      payload: {
        title: "Women360",
        body: "A habit on your list is due. Tap to open.",
        url: habit.activityCode ? "/app/activity" : "/app/habits",
        tag: `habit-${habit.id}`,
      },
    });
  }

  const medicines = await prisma.medication.findMany({ where: { userId, NOT: { times: { isEmpty: true } } } });
  for (const medicine of medicines) {
    for (const time of medicine.times) {
      const at = parseTimeOfDay(time);
      if (at === null || !inWindow(clock.minutes, at)) continue;
      // The moment this dose was due, as a real instant, to see whether she has recorded something since.
      const doseDue = new Date(now.getTime() - (clock.minutes - at) * 60_000);
      const recorded = await prisma.medicationLog.findFirst({
        where: { medicationId: medicine.id, recordedAt: { gte: new Date(doseDue.getTime() - DOSE_LOOKBACK_MINUTES * 60_000) } },
        select: { id: true },
      });
      if (recorded) continue;
      due.push({
        kind: "medication",
        refId: medicine.id,
        slot: time,
        payload: {
          title: "Women360",
          body: "A dose is due. Tap to record it.",
          url: "/app/health",
          tag: `medication-${medicine.id}-${time}`,
        },
      });
    }
  }
  return due;
}

/** True when this call is the one that gets to send it. */
async function claim(userId: string, item: Due, day: string): Promise<boolean> {
  // skipDuplicates: an already-claimed reminder is a normal answer here (every tick inside the window sees it), not an error to log.
  const { count } = await prisma.pushSent.createMany({ data: [{ userId, kind: item.kind, refId: item.refId, day, slot: item.slot }], skipDuplicates: true });
  return count === 1;
}

async function unclaim(userId: string, item: Due, day: string): Promise<void> {
  await prisma.pushSent.deleteMany({ where: { userId, kind: item.kind, refId: item.refId, day, slot: item.slot } });
}

/** Drops dedupe rows that can no longer matter. */
export async function purgeOldPushRecords(now = new Date()): Promise<number> {
  const { count } = await prisma.pushSent.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - KEEP_SENT_DAYS * 86_400_000) } } });
  return count;
}

let running = false;
let lastTickAt: Date | null = null;

/** When the reminder check last completed (for the administrator's status panel), or null if it has not yet. */
export function lastReminderTick(): Date | null {
  return lastTickAt;
}

/** One scheduled tick: never overlaps itself, never throws. */
export async function scheduledTick(send: Sender): Promise<void> {
  if (running) return;
  running = true;
  try {
    const r = await runReminderTick(new Date(), send);
    lastTickAt = new Date();
    if (r.sent > 0 || r.removedDevices > 0) logger.info(r, "Reminders sent");
  } catch (err) {
    logger.error({ err }, "Reminder tick failed");
  } finally {
    running = false;
  }
}
