import { STRICT_12H_TIME } from "@/lib/reminderTimes";
import { localDateISO, to24Hour } from "@/services/mappers";
import type { Habit } from "@/types";

/**
 * Habit reminders. A habit's reminder is a time of day ("7:00 AM"); when that time
 * comes and the habit isn't done, she is told. This file is only the decisions
 * (is a reminder due, did we already tell her) so they can be tested; showing the
 * notification is in useReminders.
 */

/** How long after its time a reminder may still fire. A tab opened much later shows the Today list instead of a stale alert. */
export const CATCH_UP_MINUTES = 15;

/** The reminder as minutes since midnight, or null when it isn't a clean time. */
export function reminderMinutes(reminder: string | undefined): number | null {
  if (!reminder || !STRICT_12H_TIME.test(reminder.trim())) return null;
  const [h, m] = to24Hour(reminder).split(":").map(Number);
  return h * 60 + m;
}

/** An "N days a week" habit stops being due once the week's quota is met (unless it was done today). */
export function isDueToday(habit: Pick<Habit, "doneToday" | "daysPerWeek" | "thisWeek">): boolean {
  if (habit.doneToday) return false;
  return !(habit.daysPerWeek < 7 && habit.thisWeek >= habit.daysPerWeek);
}

/** What has been announced already today: habit id to the day it was announced. */
export type Announced = Record<string, string>;

/** The habits whose reminder time has arrived, that are still to do, and that she hasn't been told about today. */
export function dueReminders(habits: Habit[], now: Date, announced: Announced): Habit[] {
  const today = localDateISO(now);
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  return habits.filter((h) => {
    const at = reminderMinutes(h.reminder);
    if (at === null || !isDueToday(h)) return false;
    if (announced[h.id] === today) return false;
    return minutesNow >= at && minutesNow - at <= CATCH_UP_MINUTES;
  });
}

const KEY = "w360_reminders_announced";

export function loadAnnounced(): Announced {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Announced;
    const today = localDateISO();
    // Only today's matter; dropping the rest keeps this from growing forever.
    return Object.fromEntries(Object.entries(raw).filter(([, day]) => day === today));
  } catch {
    return {};
  }
}

export function saveAnnounced(announced: Announced): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(announced));
  } catch {
    // Private mode or full storage: at worst she is told twice, never zero times.
  }
}

export type NotificationState = "unsupported" | "default" | "granted" | "denied";

export function notificationState(): NotificationState {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

/** Must be called from a click: browsers only show the permission prompt in response to one. */
export async function requestNotificationPermission(): Promise<NotificationState> {
  if (notificationState() === "unsupported") return "unsupported";
  try {
    return await Notification.requestPermission();
  } catch {
    return notificationState();
  }
}

/** Shows a system notification. Goes through the service worker so it also works where `new Notification` doesn't (Android Chrome). */
export async function showSystemNotification(title: string, body: string, url: string): Promise<boolean> {
  if (notificationState() !== "granted") return false;
  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, { body, tag: url + title, data: { url }, icon: "/favicon.svg", badge: "/favicon.svg" });
      return true;
    }
    new Notification(title, { body, icon: "/favicon.svg" });
    return true;
  } catch {
    return false;
  }
}
