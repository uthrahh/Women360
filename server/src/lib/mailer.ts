import nodemailer, { type Transporter } from "nodemailer";
import { env } from "@/config/env";
import { logger } from "@/lib/logger";

export interface Email {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Every message the test environment "sent", newest last, so tests can read a link without a mail server. */
export const outbox: Email[] = [];

let transporter: Transporter | null = null;

/** "Women360 <admin.women360@gmail.com>" -> { name, email }. */
export function parseSender(from: string): { name: string; email: string } {
  const match = /^\s*(?:"?([^"<]*?)"?\s*)?<([^>]+)>\s*$/.exec(from);
  return match ? { name: (match[1] ?? "").trim() || "Women360", email: match[2].trim() } : { name: "Women360", email: from.trim() };
}

/** Which way mail leaves: an HTTPS email API (works on hosts that block SMTP), SMTP, or nowhere. */
export function mailTransport(): "brevo" | "smtp" | "none" {
  if (env.BREVO_API_KEY) return "brevo";
  if (env.SMTP_URL) return "smtp";
  return "none";
}

async function sendViaBrevo(email: Email): Promise<void> {
  const sender = parseSender(env.mailFrom);
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": env.BREVO_API_KEY!, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ sender, to: [{ email: email.to }], subject: email.subject, htmlContent: email.html, textContent: email.text }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    // The provider's own error code and message (never the recipient or the message) is enough to act on.
    const body = (await res.json().catch(() => ({}))) as { code?: string; message?: string };
    throw new Error(`Email provider refused the message (${res.status}${body.code ? ` ${body.code}` : ""}): ${body.message ?? "no detail"}`);
  }
}

/**
 * Sends one transactional email and says whether it went. It never throws, and the caller
 * should not await it on a request path: a slow or failing mail provider must not change how
 * long a request takes (that would reveal whether an address has an account) or fail it.
 *
 * With nothing configured, nothing leaves the machine: tests collect the message in `outbox`,
 * development prints it to the console so a link can be followed, and production logs that email
 * is not configured (never the message itself).
 */
export async function sendEmail(email: Email): Promise<boolean> {
  try {
    const transport = mailTransport();
    if (transport === "brevo") {
      await sendViaBrevo(email);
      return true;
    }
    if (transport === "smtp") {
      transporter ??= nodemailer.createTransport(env.SMTP_URL);
      await transporter.sendMail({ from: env.mailFrom, to: email.to, subject: email.subject, text: email.text, html: email.html });
      return true;
    }
    if (env.isTest) {
      outbox.push(email);
      return true;
    }
    if (!env.isProduction) {
      logger.info(`Email not sent (no mail provider set). To: ${email.to}\nSubject: ${email.subject}\n\n${email.text}`);
    } else {
      logger.warn({ subject: email.subject }, "Email not sent: set BREVO_API_KEY (or SMTP_URL) so password resets and alerts can be delivered");
    }
    return false;
  } catch (err) {
    // The address is personal data, so only the failure itself is logged.
    logger.error({ err: err instanceof Error ? err.message : "unknown" }, "Email failed to send");
    return false;
  }
}
