import { createApp } from "@/app";
import { env } from "@/config/env";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { purgeOldSecurityEvents } from "@/lib/security/events";
import { purgeStaleThrottles } from "@/lib/security/throttle";

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`Women360 API listening on port ${env.PORT} (${env.NODE_ENV})`);
});

// Retention: security events are kept 90 days and stale sign-in counters a
// day. There's no cron on this host, so the long-running process sweeps on
// start and then daily. A failed sweep is logged, never fatal.
async function sweep() {
  try {
    const [events, throttles] = await Promise.all([purgeOldSecurityEvents(), purgeStaleThrottles()]);
    if (events + throttles > 0) logger.info({ events, throttles }, "Purged expired security data");
  } catch (err) {
    logger.error({ err }, "Security data sweep failed");
  }
}
void sweep();
setInterval(sweep, 24 * 3_600_000).unref();

async function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down gracefully`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  // Force-exit if graceful shutdown hangs.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
