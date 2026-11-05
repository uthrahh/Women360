import { createApp } from "@/app";
import { env } from "@/config/env";
import { logger } from "@/lib/logger";
import { alertAdmin } from "@/lib/alerts";
import { prisma } from "@/lib/prisma";
import { purgeOldSecurityEvents } from "@/lib/security/events";
import { purgeStaleThrottles } from "@/lib/security/throttle";
import { purgeOldPushRecords, scheduledTick } from "@/modules/push/dispatch";
import { sendPush } from "@/modules/push/sender";
import { rollUp } from "@/modules/usage/usage.service";

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`Women360 API listening on port ${env.PORT} (${env.NODE_ENV})`);
});

// Retention: security events are kept 90 days and stale sign-in counters a
// day. There's no cron on this host, so the long-running process sweeps on
// start and then daily. A failed sweep is logged, never fatal.
async function sweep() {
  try {
    const [events, throttles, pushRecords] = await Promise.all([purgeOldSecurityEvents(), purgeStaleThrottles(), purgeOldPushRecords()]);
    if (events + throttles + pushRecords > 0) logger.info({ events, throttles, pushRecords }, "Purged expired security data");
  } catch (err) {
    logger.error({ err }, "Security data sweep failed");
  }
}
void sweep();
void rollUp();
setInterval(sweep, 24 * 3_600_000).unref();
setInterval(() => void rollUp(), 6 * 3_600_000).unref();

// Reminders for people who allowed them on a device. Every minute, while this server is awake. The free
// hosting tier sleeps when nobody calls it, so an uptime monitor pinging /health every few minutes is what
// keeps reminders on time (docs/OPERATIONS.md). Off unless the VAPID keys are set.
if (env.pushConfigured) {
  setInterval(() => void scheduledTick(sendPush), 60_000).unref();
  logger.info("Closed-app reminders are on");
} else {
  logger.info("Closed-app reminders are off (VAPID keys not set)");
}

async function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down gracefully`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  // Force-exit if graceful shutdown hangs.
  setTimeout(() => process.exit(1), 10_000).unref();
}

// A crash or an unhandled promise rejection is the kind of failure nobody sees until a person complains.
process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled promise rejection");
  void alertAdmin("unhandledRejection", "Unhandled promise rejection", { what: reason instanceof Error ? reason.message.slice(0, 300) : String(reason).slice(0, 300) });
});
process.on("uncaughtException", async (err) => {
  logger.fatal({ err }, "Uncaught exception");
  await alertAdmin("uncaughtException", "The server crashed", { what: err.message.slice(0, 300) });
  process.exit(1);
});

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
