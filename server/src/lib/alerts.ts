import { env } from "@/config/env";
import { logger } from "@/lib/logger";
import { sendEmail } from "@/lib/mailer";

const PER_SIGNATURE_MS = 30 * 60_000;
const DAY_MS = 24 * 3_600_000;
const MAX_PER_DAY = 20;

const lastSent = new Map<string, number>();
let sentToday: number[] = [];

/** Forgets what was sent (tests). */
export function resetAlerts() {
  lastSent.clear();
  sentToday = [];
}

/**
 * Emails the person who runs the service when something is wrong on the server, so a failure
 * doesn't sit unnoticed. It is deliberately quiet: the same problem at most once every half hour
 * and at most 20 emails a day, so one broken thing can't flood an inbox (or run up a mail bill).
 * It never includes a request body, a person's details or a stack trace: only what failed, where,
 * and the request id to find it in the logs. Alerts need mail to be configured; without it the
 * problem is still logged.
 *
 * Returns whether an email was sent.
 */
export async function alertAdmin(signature: string, subject: string, details: Record<string, string | number | undefined>): Promise<boolean> {
  const now = Date.now();
  if (now - (lastSent.get(signature) ?? 0) < PER_SIGNATURE_MS) return false;
  sentToday = sentToday.filter((t) => now - t < DAY_MS);
  if (sentToday.length >= MAX_PER_DAY) return false;
  lastSent.set(signature, now);
  sentToday.push(now);

  const lines = Object.entries(details).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}: ${v}`);
  const text = [`Women360 (${env.NODE_ENV}) needs a look.`, "", ...lines, "", `Time: ${new Date(now).toISOString()}`, "", "This alert is limited to one per problem every 30 minutes."].join("\n");
  const html = `<p>Women360 (${env.NODE_ENV}) needs a look.</p><pre style="font-family:monospace">${lines.join("\n").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!)}</pre><p>Time: ${new Date(now).toISOString()}</p>`;
  const sent = await sendEmail({ to: env.SUPPORT_EMAIL, subject: `[Women360] ${subject}`, text, html });
  if (!sent) logger.warn({ signature }, "Admin alert could not be emailed");
  return sent;
}
