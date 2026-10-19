import { to12Hour } from "@/services/mappers";

// Every 15 minutes across the day, stored/selected in 24h but labelled in 12h
// for readability. A fixed time slot rather than free text, so a reminder is
// always something that could actually be scheduled against.
export const REMINDER_TIME_OPTIONS: { value: string; label: string }[] = Array.from({ length: 24 * 4 }, (_, i) => {
  const hh = String(Math.floor(i / 4)).padStart(2, "0");
  const mm = String((i % 4) * 15).padStart(2, "0");
  const value = `${hh}:${mm}`;
  return { value, label: to12Hour(value) };
});

export const DEFAULT_REMINDER = "09:00";

// Older reminders may be free text from before this was a time picker; only a
// clean "9:00 AM" can be turned back into a slot.
export const STRICT_12H_TIME = /^\d{1,2}:\d{2}\s?(AM|PM)$/i;
