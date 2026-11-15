import { env } from "@/config/env";
import type { Email } from "@/lib/mailer";

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * One plain, readable layout for every message: no images, no tracking. Every template here is transactional.
 * A marketing template must set category "marketing", pass unsubscribeUrl, and put that link and env.MAIL_POSTAL_ADDRESS
 * in its text and html (use marketingFooter below); sendEmail refuses it otherwise.
 */
export function marketingFooter(unsubscribeUrl: string): string[] {
  return [`You're receiving this because you chose to hear from Women360. Unsubscribe: ${unsubscribeUrl}`, env.MAIL_POSTAL_ADDRESS ?? ""];
}

function layout(heading: string, paragraphs: string[], action?: { label: string; url: string }): { text: string; html: string } {
  const footer = env.SUPPORT_EMAIL ? `Questions? Write to ${env.SUPPORT_EMAIL}.` : "";
  const text = [heading, "", ...paragraphs, ...(action ? ["", `${action.label}: ${action.url}`] : []), "", footer].join("\n").trim();
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f6f6f6;font-family:Inter,Arial,sans-serif;color:#0a0a0a;">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e6e6e6;border-radius:8px;padding:28px;">
<p style="margin:0 0 16px;font-family:Georgia,serif;font-size:20px;color:#d6006f;">Women360</p>
<h1 style="margin:0 0 16px;font-size:18px;">${escapeHtml(heading)}</h1>
${paragraphs.map((p) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.5;">${escapeHtml(p)}</p>`).join("\n")}
${action ? `<p style="margin:20px 0;"><a href="${escapeHtml(action.url)}" style="display:inline-block;background:#0a0a0a;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-size:15px;">${escapeHtml(action.label)}</a></p><p style="margin:0 0 12px;font-size:13px;color:#5c5c5c;word-break:break-all;">Or paste this link into your browser: ${escapeHtml(action.url)}</p>` : ""}
${footer ? `<p style="margin:20px 0 0;font-size:13px;color:#5c5c5c;">${escapeHtml(footer)}</p>` : ""}
</div></body></html>`;
  return { text, html };
}

export function verifyEmailEmail(to: string, token: string): Email {
  const url = `${env.appUrl}/verify-email?token=${encodeURIComponent(token)}`;
  const { text, html } = layout(
    "Confirm your email address",
    [
      "Please confirm that this is your address, so that you can reset your password if you ever forget it.",
      "This link works once and expires in 48 hours. If you didn't create a Women360 account, you can ignore this message.",
    ],
    { label: "Confirm my email", url }
  );
  return { to, subject: "Confirm your Women360 email address", text, html };
}

export function passwordResetEmail(to: string, token: string): Email {
  const url = `${env.appUrl}/reset-password?token=${encodeURIComponent(token)}`;
  const { text, html } = layout(
    "Reset your password",
    [
      "We received a request to reset the password for your Women360 account.",
      "This link works once and expires in one hour. If you didn't ask for this, you can ignore this message and your password will stay as it is.",
    ],
    { label: "Choose a new password", url }
  );
  return { to, subject: "Reset your Women360 password", text, html };
}
