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
  SUPPORT_EMAIL: z.string().email().optional(),
  // Two-factor sign-in is only offered when this is set: a base64-encoded
  // 32-byte key (`openssl rand -base64 32`) that encrypts each person's
  // authenticator secret at rest. Unset = the feature is off, nothing breaks.
  TWO_FACTOR_ENCRYPTION_KEY: z.string().optional(),
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

export const env = {
  ...parsed.data,
  twoFactorKey,
  twoFactorAvailable: twoFactorKey !== null,
  adminIpAllowlist: (parsed.data.ADMIN_IP_ALLOWLIST ?? "").split(",").map((ip) => ip.trim()).filter(Boolean),
  isProduction: parsed.data.NODE_ENV === "production",
  isTest: parsed.data.NODE_ENV === "test",
  corsOrigins: parsed.data.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean),
};
