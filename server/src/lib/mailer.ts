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

/**
 * Sends one transactional email. It never throws and the caller should not await
 * it on a request path: a slow or failing mail server must not change how long a
 * request takes (that would reveal whether an address has an account) or fail it.
 *
 * With no SMTP_URL set, nothing leaves the machine: tests collect the message in
 * `outbox`, development prints it to the console so a link can be followed, and
 * production logs that email is not configured (never the message itself).
 */
export async function sendEmail(email: Email): Promise<void> {
  try {
    if (env.SMTP_URL && env.MAIL_FROM) {
      transporter ??= nodemailer.createTransport(env.SMTP_URL);
      await transporter.sendMail({ from: env.MAIL_FROM, to: email.to, subject: email.subject, text: email.text, html: email.html });
      return;
    }
    if (env.isTest) {
      outbox.push(email);
    } else if (!env.isProduction) {
      logger.info(`Email not sent (no SMTP_URL). To: ${email.to}\nSubject: ${email.subject}\n\n${email.text}`);
    } else {
      logger.warn({ subject: email.subject }, "Email not sent: SMTP_URL and MAIL_FROM are not set");
    }
  } catch (err) {
    // The address is personal data, so only the failure itself is logged.
    logger.error({ err: err instanceof Error ? err.message : "unknown" }, "Email failed to send");
  }
}
