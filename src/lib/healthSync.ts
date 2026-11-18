import { Capacitor } from "@capacitor/core";
import { localDay, stepsFromBuckets, syncWindow, type DaySteps } from "./stepsImport";

/**
 * Reading daily step totals from the phone's own health store (Health Connect on Android).
 * Only the installed Android app can do this; the website and the iPhone app have no such bridge yet, so there the person imports a file instead.
 * The health library is loaded only when this is used, so it never weighs on the first screen.
 *
 * Women360 asks for one thing: permission to READ steps. It never writes to the health store.
 */
export type DeviceStatus = "unsupported" | "needs-health-connect" | "ready";

/** How many days back one sync looks (Health Connect lets an app read about 30 days without a special history permission). */
export const DEVICE_SYNC_DAYS = 30;

const load = () => import("@capgo/capacitor-health").then((m) => m.Health);

/** True only inside the installed Android app. */
export function deviceSyncPossible(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export async function deviceStatus(): Promise<DeviceStatus> {
  if (!deviceSyncPossible()) return "unsupported";
  try {
    const health = await load();
    const { available } = await health.isAvailable();
    return available ? "ready" : "needs-health-connect";
  } catch {
    return "unsupported";
  }
}

/** Has she already allowed Women360 to read steps? Never shows a prompt. */
export async function deviceAllowed(): Promise<boolean> {
  try {
    const health = await load();
    const s = await health.checkAuthorization({ read: ["steps"] });
    return s.readAuthorized.includes("steps");
  } catch {
    return false;
  }
}

/** Shows Health Connect's own permission sheet. Resolves true only if she allowed reading steps. */
export async function askDevicePermission(): Promise<boolean> {
  const health = await load();
  const s = await health.requestAuthorization({ read: ["steps"] });
  return s.readAuthorized.includes("steps");
}

/** One total per local day for the last `days` days, today included (today's is the count so far). */
export async function readDeviceSteps(today: string, days = DEVICE_SYNC_DAYS): Promise<DaySteps[]> {
  const health = await load();
  const { from } = syncWindow(today, days);
  const [y, m, d] = from.split("-").map(Number);
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  const end = new Date();
  const { samples } = await health.queryAggregated({
    dataType: "steps",
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    bucket: "day",
    aggregation: "sum",
  });
  return stepsFromBuckets(samples.map((s) => ({ startDate: s.startDate, value: s.value })));
}

export { localDay };
