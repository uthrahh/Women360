import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("30d"),
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
  // Where people write for help, and the address emails are sent from unless MAIL_FROM says otherwise.
  SUPPORT_EMAIL: z.string().email().default("admin.women360@gmail.com"),
  // Two-factor sign-in is only offered when this is set: a base64-encoded
  // 32-byte key (`openssl rand -base64 32`) that encrypts each person's
  // authenticator secret at rest. Unset = the feature is off, nothing breaks.
  TWO_FACTOR_ENCRYPTION_KEY: z.string().optional(),
  // Outgoing email, by an HTTPS email API (BREVO_API_KEY: works on hosts such as Render's free tier that
  // block SMTP) or by SMTP (SMTP_URL, like smtps://user:password@smtp.example.com:465). Either one is
  // enough. MAIL_FROM like "Women360 <admin.women360@gmail.com>" defaults to the support address,
  // and the provider must have verified that sender. Without a provider no email leaves the server,
  // and the app says so rather than pretending.
  BREVO_API_KEY: z.string().optional(),
  SMTP_URL: z.string().optional(),
  MAIL_FROM: z.string().optional(),
  // Where the web app lives, for links inside emails. Defaults to the first allowed CORS origin.
  APP_URL: z.string().url().optional(),
  // Request limits per address. The defaults are for production; the browser tests raise them because one
  // address makes far more requests than any person would.
  API_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(120),
  AUTH_RATE_LIMIT_PER_15_MIN: z.coerce.number().int().positive().default(20),
  // Reminders that reach her when the app is closed (web push). Generate the pair once with
  // `npm run push:keys` and set both on the server; without them the feature is off and the app says
  // reminders only appear while it is open. The public key is sent to browsers; the private key never leaves the server.
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  // Lets the nightly backup job tell the API that a restore was verified (shown in the administrator's status panel).
  // At least 32 characters; set the same value as the BACKUP_REPORT_TOKEN repository secret. Unset = no reporting.
  BACKUP_REPORT_TOKEN: z.string().min(32, "BACKUP_REPORT_TOKEN must be at least 32 characters").optional(),
  // Optional comma-separated list of IP addresses allowed to reach /admin.
  ADMIN_IP_ALLOWLIST: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast and loud rather than booting with an invalid/insecure config.
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

let twoFactorKey: Buffer | null = null;
if (parsed.data.TWO_FACTOR_ENCRYPTION_KEY) {
  twoFactorKey = Buffer.from(parsed.data.TWO_FACTOR_ENCRYPTION_KEY, "base64");
  if (twoFactorKey.length !== 32) {
    // A wrong-length key would silently weaken or break encryption — refuse to boot.
    console.error("TWO_FACTOR_ENCRYPTION_KEY must be a base64-encoded 32-byte key (openssl rand -base64 32).");
    process.exit(1);
  }
}

if (Boolean(parsed.data.VAPID_PUBLIC_KEY) !== Boolean(parsed.data.VAPID_PRIVATE_KEY)) {
  console.error("Set both VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY, or neither (npm run push:keys makes a pair).");
  process.exit(1);
}

export const env = {
  ...parsed.data,
  twoFactorKey,
  twoFactorAvailable: twoFactorKey !== null,
  adminIpAllowlist: (parsed.data.ADMIN_IP_ALLOWLIST ?? "").split(",").map((ip) => ip.trim()).filter(Boolean),
  pushConfigured: Boolean(parsed.data.VAPID_PUBLIC_KEY && parsed.data.VAPID_PRIVATE_KEY),
  mailConfigured: Boolean(parsed.data.BREVO_API_KEY || parsed.data.SMTP_URL),
  mailFrom: parsed.data.MAIL_FROM ?? `Women360 <${parsed.data.SUPPORT_EMAIL}>`,
  appUrl: (parsed.data.APP_URL ?? parsed.data.CORS_ORIGINS.split(",")[0].trim()).replace(/\/+$/, ""),
  isProduction: parsed.data.NODE_ENV === "production",
  isTest: parsed.data.NODE_ENV === "test",
  corsOrigins: parsed.data.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean),
};
