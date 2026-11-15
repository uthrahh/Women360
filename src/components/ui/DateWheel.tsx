import { useMemo, useState } from "react";
import { WheelPicker, type WheelItem } from "./WheelPicker";
import { daysInMonth } from "@/lib/wheel";
import { localDateISO } from "@/services/mappers";

interface DateWheelProps {
  /** "YYYY-MM-DD", or "" when she hasn't chosen yet. */
  value: string;
  onChange: (value: string) => void;
  label: string;
  error?: string;
  /** Where the year wheel starts when nothing is chosen (default: 30 years ago). */
  startYear?: number;
  /** How many years back the year wheel goes (default 110). */
  yearsBack?: number;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * A date chosen on three wheels: day, month, year. The day wheel follows the month (and leap years), keeping the day
 * where it can. Until she moves a wheel the value stays empty, so the starting position is never mistaken for an answer.
 */
export function DateWheel({ value, onChange, label, error, startYear, yearsBack = 110 }: DateWheelProps) {
  const thisYear = Number(localDateISO().slice(0, 4));
  const initial = value ? value.split("-").map(Number) : [startYear ?? thisYear - 30, 1, 1];
  const [y, setY] = useState(initial[0]);
  const [m, setM] = useState(initial[1]);
  const [d, setD] = useState(initial[2]);
  const [chosen, setChosen] = useState(Boolean(value));

  const years = useMemo<WheelItem<number>[]>(() => Array.from({ length: yearsBack + 1 }, (_, i) => ({ value: thisYear - yearsBack + i, label: String(thisYear - yearsBack + i) })), [thisYear, yearsBack]);
  const months = useMemo<WheelItem<number>[]>(
    () => Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: new Date(Date.UTC(2000, i, 1)).toLocaleDateString(undefined, { month: "short", timeZone: "UTC" }) })),
    []
  );
  const dayCount = daysInMonth(y, m);
  const days = useMemo<WheelItem<number>[]>(() => Array.from({ length: dayCount }, (_, i) => ({ value: i + 1, label: String(i + 1) })), [dayCount]);

  function emit(ny: number, nm: number, nd: number, touchedNow = chosen) {
    const day = Math.min(nd, daysInMonth(ny, nm));
    if (day !== nd) setD(day);
    if (touchedNow) onChange(`${ny}-${pad(nm)}-${pad(day)}`);
  }
  const touch = () => {
    if (!chosen) {
      setChosen(true);
      emit(y, m, d, true);
    }
  };

  const errorId = `${label.replace(/\W+/g, "-").toLowerCase()}-error`;
  return (
    <fieldset aria-describedby={error ? errorId : undefined}>
      <legend className="text-sm font-medium senior:text-lg mb-2">{label}</legend>
      <div className="grid grid-cols-[1fr_1.3fr_1.4fr] gap-2">
        <WheelPicker label="Day" items={days} value={Math.min(d, dayCount)} onTouch={touch} onChange={(v) => { setD(v); emit(y, m, v); }} />
        <WheelPicker label="Month" items={months} value={m} onTouch={touch} onChange={(v) => { setM(v); emit(y, v, d); }} />
        <WheelPicker label="Year" items={years} value={y} onTouch={touch} onChange={(v) => { setY(v); emit(v, m, d); }} />
      </div>
      {error && (
        <p id={errorId} className="text-sm mt-2 text-[var(--w360-danger-text)]">
          {error}
        </p>
      )}
    </fieldset>
  );
}
