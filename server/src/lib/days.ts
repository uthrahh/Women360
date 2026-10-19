import { BadRequestError } from "@/lib/errors";
import { dayNumber, toIsoDay } from "@/lib/streak";

// How far from the server's own UTC date a client-supplied day may be. Real
// timezones span UTC-12..UTC+14, so a day of slack either side is honest;
// anything further is a wrong clock or a hand-made request.
const FUTURE_SLACK_DAYS = 1;
const BACKFILL_DAYS = 7;

/** Rejects a "today"/log day that can't be a real current day for anyone, or is too far back to fill in. */
export function assertPlausibleDay(isoDay: string, now = new Date()) {
  const offset = dayNumber(isoDay) - dayNumber(toIsoDay(now));
  if (offset > FUTURE_SLACK_DAYS) throw new BadRequestError("You can't log a future day.");
  if (offset < -BACKFILL_DAYS) throw new BadRequestError("That day is too far back to log.");
}
