import { prisma } from "@/lib/prisma";
import { env } from "@/config/env";
import { clinicalContentOn } from "@/config/features";
import { lastReminderTick } from "@/modules/push/dispatch";

const startedAt = new Date();
const KEEP_REPORTS = 60;

export interface SystemStatus {
  checkedAt: string;
  environment: string;
  /** When this API process started. A recent time means it had been asleep or was just deployed. */
  startedAt: string;
  database: { ok: boolean; ms: number | null };
  email: { configured: boolean; provider: "brevo" | "smtp" | null; from: string };
  reminders: { configured: boolean; lastCheckAt: string | null };
  clinicalContent: boolean;
  twoFactorAvailable: boolean;
  backup: { lastVerifiedRestoreAt: string | null; tables: number | null; rows: number | null; reporting: boolean };
}

/** What the running server knows about itself. Booleans and times only: never a key, address or person. */
export async function systemStatus(): Promise<SystemStatus> {
  const t0 = Date.now();
  let dbOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    dbOk = false;
  }
  const last = dbOk ? await prisma.backupReport.findFirst({ orderBy: { createdAt: "desc" } }).catch(() => null) : null;
  const tick = lastReminderTick();
  return {
    checkedAt: new Date().toISOString(),
    environment: env.NODE_ENV,
    startedAt: startedAt.toISOString(),
    database: { ok: dbOk, ms: dbOk ? Date.now() - t0 : null },
    email: {
      configured: env.mailConfigured,
      provider: env.BREVO_API_KEY ? "brevo" : env.SMTP_URL ? "smtp" : null,
      from: env.mailFrom,
    },
    reminders: { configured: env.pushConfigured, lastCheckAt: tick ? tick.toISOString() : null },
    clinicalContent: clinicalContentOn(),
    twoFactorAvailable: env.twoFactorAvailable,
    backup: {
      lastVerifiedRestoreAt: last ? last.createdAt.toISOString() : null,
      tables: last?.tables ?? null,
      rows: last?.rows ?? null,
      reporting: Boolean(env.BACKUP_REPORT_TOKEN),
    },
  };
}

/** Records that a backup was just restored and checked. Keeps only the newest reports. */
export async function recordBackupReport(tables: number, rows: number): Promise<void> {
  await prisma.backupReport.create({ data: { tables, rows } });
  const old = await prisma.backupReport.findMany({ orderBy: { createdAt: "desc" }, skip: KEEP_REPORTS, select: { id: true } });
  if (old.length > 0) await prisma.backupReport.deleteMany({ where: { id: { in: old.map((r) => r.id) } } });
}
