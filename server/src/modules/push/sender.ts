import webpush from "web-push";
import { env } from "@/config/env";

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** What the browser's service worker receives. Deliberately short and generic: it can appear on a locked screen. */
export interface PushPayload {
  title: string;
  body: string;
  /** Where tapping it opens, inside the app. */
  url: string;
  /** Same tag = the newer notification replaces the older one instead of stacking. */
  tag: string;
}

/** "sent", "gone" (the browser no longer wants messages: forget the device) or "failed" (try again later). */
export type SendResult = "sent" | "gone" | "failed";
export type Sender = (target: PushTarget, payload: PushPayload) => Promise<SendResult>;

let configured = false;

/** Sends through the browser's push service, encrypted for that one device. */
export const sendPush: Sender = async (target, payload) => {
  if (!env.pushConfigured) return "failed";
  if (!configured) {
    webpush.setVapidDetails(`mailto:${env.SUPPORT_EMAIL}`, env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);
    configured = true;
  }
  try {
    await webpush.sendNotification(
      { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
      JSON.stringify(payload),
      // A reminder that couldn't be delivered within half an hour is no longer a reminder.
      { TTL: 30 * 60, urgency: "normal", timeout: 10_000 }
    );
    return "sent";
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    return status === 404 || status === 410 ? "gone" : "failed";
  }
};
