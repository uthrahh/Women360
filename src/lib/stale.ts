import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

/**
 * Stale-while-revalidate for the screens she returns to all day. The last data a screen showed is kept, so coming back to it
 * paints that at once while the screen asks the server for fresh data and swaps it in.
 *
 * The copy lives in memory only, never in localStorage or any other storage that outlives the tab: it is health information.
 * It is dropped when she signs out or her session ends, it is keyed by her account, and it is ignored once it is older than
 * MAX_AGE_MS (a screen she hasn't opened for a while loads normally rather than showing something long out of date).
 */
const MAX_AGE_MS = 10 * 60_000;
const store = new Map<string, { value: unknown; at: number }>();

export function clearStaleCache(): void {
  store.clear();
}

/** Remembers a value under a key (the hook does this after every change). */
export function rememberStale(key: string, value: unknown): void {
  store.set(key, { value, at: Date.now() });
}

export function peekStale<T>(key: string | null): T | undefined {
  if (!key) return undefined;
  const entry = store.get(key);
  return entry && Date.now() - entry.at < MAX_AGE_MS ? (entry.value as T) : undefined;
}

/**
 * Like useState, but starts from the last value seen under `key` (when there is a recent one) and remembers every change.
 * `initial` is what "nothing loaded yet" looks like (null, an empty list, false); it is never remembered.
 */
export function useStaleState<T>(key: string | null, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => peekStale<T>(key) ?? initial);
  useEffect(() => {
    if (key && value !== initial) rememberStale(key, value);
    // `initial` is a constant for the caller (null, false, [] literal); comparing by identity is what is wanted here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, value]);
  return [value, setValue];
}
