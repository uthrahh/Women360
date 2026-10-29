import { dayNumber } from "@/lib/streak";

/** Minutes after midnight for "11:00 PM", "7:05 am" or a 24-hour "23:00"; null when it can't be read. */
export function clockMinutes(time: string): number | null {
  const match = /^\s*(\d{1,2}):(\d{2})\s*(AM|PM)?\s*$/i.exec(time);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();
  if (minute > 59 || hour > (meridiem ? 12 : 23) || (meridiem && hour === 0)) return null;
  const h = meridiem ? (hour % 12) + (meridiem === "PM" ? 12 : 0) : hour;
  return h * 60 + minute;
}

/**
 * How long she slept, from the day and time she went to bed to the day and time she woke. The
 * server works this out itself rather than trusting a number sent by the client. Null means the
 * span can't be right: a time that can't be read, waking before going to bed, or more than a day.
 */
export function sleepDurationHours(bedDate: string, bedtime: string, wakeDate: string, wakeTime: string): number | null {
  const bed = clockMinutes(bedtime);
  const wake = clockMinutes(wakeTime);
  if (bed === null || wake === null) return null;
  const minutes = (dayNumber(wakeDate) - dayNumber(bedDate)) * 1440 + wake - bed;
  if (minutes <= 0 || minutes > 1440) return null;
  return Math.round((minutes / 60) * 10) / 10;
}
