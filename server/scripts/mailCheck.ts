/**
 * Sends one real test email so you can see that password-reset mail will arrive.
 *   npm run mail:check -- someone@example.com
 * It reads the same settings the server does (BREVO_API_KEY or SMTP_URL, MAIL_FROM, SUPPORT_EMAIL).
 */
import "dotenv/config";
import { env } from "@/config/env";
import { mailTransport, sendEmail } from "@/lib/mailer";
import { passwordResetEmail } from "@/lib/emailTemplates";

async function main() {
  const to = process.argv[2];
  if (!to) {
    console.error("Usage: npm run mail:check -- you@example.com");
    process.exit(2);
  }
  const transport = mailTransport();
  console.log(`Transport: ${transport}   From: ${env.mailFrom}   Links point to: ${env.appUrl}`);
  if (transport === "none") {
    console.error("No mail provider is set. Set BREVO_API_KEY (or SMTP_URL) and try again.");
    process.exit(1);
  }
  const sent = await sendEmail(passwordResetEmail(to, "test-token-not-a-real-reset-link"));
  console.log(sent ? "Sent. Check the inbox (and the spam folder) for 'Reset your Women360 password'. The link in it is a dummy." : "Not sent. See the error above.");
  process.exit(sent ? 0 : 1);
}
void main();
