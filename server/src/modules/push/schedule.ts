/**
 * The decisions behind a closed-app reminder, kept pure so they can be tested without a clock,
 * a database or a push service.
 */

/** A reminder may still be sent this long after its time (the server may have been asleep, or a tick late). Later than that it is stale. */
export const CATCH_UP_MINUTES = 20;

/** "7:00 AM" / "12:30 pm" as minutes since midnight, or null when it isn't a clean 12-hour time (older reminders were free text). */
export function parseReminder(text: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})\s?(AM|PM)$/i.exec((text ?? "").trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour < 1 || hour > 12 || minute > 59) return null;
  return (hour % 12) * 60 + (m[3].toUpperCase() === "PM" ? 12 * 60 : 0) + minute;
}

/** "08:00" as minutes since midnight, or null. */
export function parseTimeOfDay(text: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(text.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** True when `timeZone` is a zone this server knows. */
export function isKnownTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** The calendar day ("2026-11-05") and minutes since midnight where she is at this moment. An unknown zone falls back to UTC. */
export function localClock(now: Date, timeZone: string): { day: string; minutes: number } {
  const zone = isKnownTimeZone(timeZone) ? timeZone : "UTC";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return { day: `${get("year")}-${get("month")}-${get("day")}`, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

/** True from the reminder's minute until CATCH_UP_MINUTES after it, within the same day. */
export function inWindow(nowMinutes: number, atMinutes: number): boolean {
  return nowMinutes >= atMinutes && nowMinutes - atMinutes <= CATCH_UP_MINUTES;
}

/**
 * Push services this server is willing to send to. The address of a subscription comes from the
 * person's browser, so without this list anyone could make the server send a request to any address
 * they choose. These are the services the major browsers use.
 */
export function isTrustedPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) return false;
  const host = url.hostname.toLowerCase();
  return (
    host === "fcm.googleapis.com" || // Chrome, Edge, Brave, Opera and most Android browsers
    host === "updates.push.services.mozilla.com" || // Firefox
    host.endsWith(".push.services.mozilla.com") ||
    host.endsWith(".notify.windows.com") || // Edge on Windows
    host === "web.push.apple.com" || // Safari and installed web apps on iPhone and iPad
    host.endsWith(".push.apple.com")
  );
}
