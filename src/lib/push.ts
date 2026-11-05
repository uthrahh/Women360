import { request } from "@/services/apiClient";
import { isNativeApp } from "@/lib/platform";
import { notificationState, requestNotificationPermission } from "@/lib/reminders";

/**
 * Reminders that reach her when Women360 is closed: the browser holds a "push subscription" and the
 * server sends a short message to it at her reminder times. This file is the browser half.
 * What it cannot do: the installed Android app (its web view has no push), and an iPhone/iPad unless
 * Women360 has been added to the Home Screen first (Apple's rule, not ours).
 */

export type PushOutcome = "on" | "denied" | "unsupported" | "unavailable" | "error";

export function pushSupported(): boolean {
  return !isNativeApp() && typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** An iPhone or iPad in a normal Safari tab, where push only works once the app is added to the Home Screen. */
export function needsHomeScreenForPush(): boolean {
  if (typeof navigator === "undefined" || isNativeApp()) return false;
  const apple = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const installed = (navigator as unknown as { standalone?: boolean }).standalone === true || window.matchMedia?.("(display-mode: standalone)").matches;
  return apple && !installed && !("PushManager" in window);
}

function keyBytes(base64Url: string): Uint8Array {
  const padded = base64Url + "=".repeat((4 - (base64Url.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const timezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

async function registration(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register("/sw.js");
  return navigator.serviceWorker.ready;
}

async function send(subscription: PushSubscription): Promise<void> {
  const json = subscription.toJSON();
  await request("/push/subscribe", {
    method: "POST",
    body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys, timezone: timezone() }),
  });
}

/** Whether this device is currently set up to get reminders while closed. */
export async function pushIsOn(): Promise<boolean> {
  if (!pushSupported() || notificationState() !== "granted") return false;
  try {
    return (await (await registration()).pushManager.getSubscription()) !== null;
  } catch {
    return false;
  }
}

/** The browser's first contact with its push service can take many seconds (it registers the device); give up after this. */
const SUBSCRIBE_TIMEOUT_MS = 60_000;

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timed out")), ms);
    work.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

/** Asks permission if needed (call from a tap) and subscribes this device. */
export async function enablePush(publicKey: string | null): Promise<PushOutcome> {
  if (!pushSupported()) return "unsupported";
  if (!publicKey) return "unavailable";
  const permission = await requestNotificationPermission();
  if (permission === "denied" || permission === "default") return "denied";
  try {
    return await withTimeout(subscribeThisDevice(publicKey), SUBSCRIBE_TIMEOUT_MS);
  } catch {
    return "error";
  }
}

async function subscribeThisDevice(publicKey: string): Promise<PushOutcome> {
  const reg = await registration();
  const subscription =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) as BufferSource }));
  await send(subscription);
  return "on";
}

/** Quietly re-registers a device that is already set up (refreshes the time zone; recovers if the server forgot it). Never prompts. */
export async function refreshPush(): Promise<void> {
  if (!(await pushIsOn())) return;
  try {
    const subscription = await (await registration()).pushManager.getSubscription();
    if (subscription) await send(subscription);
  } catch {
    // Offline, or a shared demonstration account: nothing to do, and nothing to tell her.
  }
}

/** Stops reminders on this device. */
export async function disablePush(): Promise<boolean> {
  if (!pushSupported()) return true;
  try {
    const subscription = await (await registration()).pushManager.getSubscription();
    if (subscription) {
      await request("/push/unsubscribe", { method: "POST", body: JSON.stringify({ endpoint: subscription.endpoint }) });
      await subscription.unsubscribe();
    }
    return true;
  } catch {
    return false;
  }
}
