/**
 * Getting daily step totals out of what a phone or a file gives us, without sending anything but one number per day.
 * Three sources, one shape ({ date: "YYYY-MM-DD", steps }):
 *  - Health Connect on Android (the phone's own health store; read through the app),
 *  - an Apple Health export (export.xml from the Health app: it can be very large, so it is read in pieces and nothing leaves the browser except the totals),
 *  - a plain CSV with a date and a step count on each line.
 */
export interface DaySteps {
  date: string;
  steps: number;
}

/** What the server accepts in one go (mirrors STEPS_SYNC_MAX_DAYS on the server). */
export const MAX_SYNC_DAYS = 90;
const MAX_STEPS_PER_DAY = 200_000;

const pad = (n: number) => String(n).padStart(2, "0");
/** A date as the person's own calendar day, not UTC. */
export function localDay(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The first and last day (inclusive) worth keeping when today is `today`. */
export function syncWindow(today: string, days: number): { from: string; to: string } {
  const [y, m, d] = today.split("-").map(Number);
  const from = new Date(y, m - 1, d - (Math.min(days, MAX_SYNC_DAYS) - 1));
  return { from: localDay(from), to: today };
}

/**
 * Daily buckets from the health store (each with the start of the day it covers and a step count) become one entry per local day.
 * A count that isn't a whole, sensible number is dropped rather than guessed at.
 */
export function stepsFromBuckets(buckets: { startDate: string; value: number }[]): DaySteps[] {
  const byDay = new Map<string, number>();
  for (const b of buckets) {
    const t = new Date(b.startDate);
    if (Number.isNaN(t.getTime()) || !Number.isFinite(b.value) || b.value < 0) continue;
    const day = localDay(t);
    byDay.set(day, Math.min(MAX_STEPS_PER_DAY, (byDay.get(day) ?? 0) + Math.round(b.value)));
  }
  return [...byDay].map(([date, steps]) => ({ date, steps })).sort((a, b) => a.date.localeCompare(b.date));
}

/** "date,steps" lines. A header line, blank lines and anything unreadable are skipped and counted, never turned into numbers. */
export function parseStepsCsv(text: string, window: { from: string; to: string }): { days: DaySteps[]; skipped: number } {
  const days = new Map<string, number>();
  let skipped = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const [dateText, stepsText] = line.split(/[,;\t]/).map((s) => s.trim().replace(/^"|"$/g, ""));
    if (/^date$/i.test(dateText)) continue;
    const steps = Number(stepsText?.replace(/[\s_]/g, ""));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText ?? "") || !Number.isInteger(steps) || steps < 0 || steps > MAX_STEPS_PER_DAY) {
      skipped += 1;
      continue;
    }
    if (dateText < window.from || dateText > window.to) continue;
    days.set(dateText, steps);
  }
  return { days: [...days].map(([date, steps]) => ({ date, steps })).sort((a, b) => a.date.localeCompare(b.date)), skipped };
}

/**
 * Apple Health's export lists every reading, from each source (the iPhone, the Watch, other apps). Adding sources together would
 * count the same walk twice, so a day takes the source that counted the most.
 */
export class AppleStepsReader {
  private carry = "";
  private bySource = new Map<string, Map<string, number>>();
  constructor(private window: { from: string; to: string }) {}

  /** Feed the file's text in pieces, in order. */
  push(chunk: string, last = false): void {
    const text = this.carry + chunk;
    // A <Record .../> element can be cut in half at the end of a piece; keep from the last "<" and finish it with the next piece.
    // At the end of the file nothing more is coming, so whatever is left is read as it stands.
    const cut = last ? -1 : text.lastIndexOf("<");
    const whole = cut === -1 ? text : text.slice(0, cut);
    this.carry = cut === -1 ? "" : text.slice(cut);
    for (const m of whole.matchAll(/<Record\b[^>]*HKQuantityTypeIdentifierStepCount[^>]*>/g)) this.read(m[0]);
  }

  private read(tag: string) {
    const attrs: Record<string, string> = {};
    for (const a of tag.matchAll(/(\w+)="([^"]*)"/g)) attrs[a[1]] = a[2];
    const day = attrs.startDate?.slice(0, 10);
    const value = Number(attrs.value);
    if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day) || day < this.window.from || day > this.window.to || !Number.isFinite(value) || value < 0) return;
    const source = attrs.sourceName ?? "unknown";
    const days = this.bySource.get(source) ?? new Map<string, number>();
    days.set(day, (days.get(day) ?? 0) + value);
    this.bySource.set(source, days);
  }

  result(): DaySteps[] {
    this.push("", true); // the end of the file: read what was held back
    const best = new Map<string, number>();
    for (const days of this.bySource.values()) for (const [day, n] of days) best.set(day, Math.max(best.get(day) ?? 0, n));
    return [...best]
      .map(([date, steps]) => ({ date, steps: Math.min(MAX_STEPS_PER_DAY, Math.round(steps)) }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}

/** Reads an Apple Health export without loading it all into memory. */
export async function readAppleHealthExport(file: Blob, window: { from: string; to: string }): Promise<DaySteps[]> {
  const reader = new AppleStepsReader(window);
  const stream = file.stream().pipeThrough(new TextDecoderStream());
  const r = stream.getReader();
  for (;;) {
    const { value, done } = await r.read();
    if (done) break;
    reader.push(value);
  }
  return reader.result();
}
