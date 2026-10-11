import type { CycleDay } from "@/types";
import { contextTagLabel } from "./cycleContext";

const HEADER = [
  "Date",
  "Period day",
  "Flow",
  "Pain (0-4)",
  "Energy (0-4)",
  "Mood",
  "Symptoms",
  "What was going on",
  "Cycle left out of predictions",
  "Notes",
];

// A cell that starts with = + - or @ is executed as a formula by Excel and
// Sheets. Notes and symptoms are free text the person typed, so neutralise
// them before they leave the app in a file someone will open in a
// spreadsheet. Numbers and dates we generate ourselves are never prefixed.
function cell(value: string | number | undefined, isFreeText = false): string {
  let text = value === undefined ? "" : String(value);
  if (isFreeText && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** One row per logged day, oldest first — her own data, in a format she can keep, open anywhere, or hand to a clinician. */
export function buildCycleCsv(days: CycleDay[]): string {
  const rows = [...days]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) =>
      [
        cell(d.date),
        cell(d.isPeriod ? "yes" : "no"),
        cell(d.flow ?? ""),
        cell(d.pain),
        cell(d.energy),
        cell(d.mood, true),
        cell((d.symptoms ?? []).join("; "), true),
        cell((d.contextTags ?? []).map(contextTagLabel).join("; ")),
        cell(d.excludeCycle ? "yes" : ""),
        cell(d.notes, true),
      ].join(",")
    );
  return [HEADER.map((h) => cell(h)).join(","), ...rows].join("\r\n") + "\r\n";
}
