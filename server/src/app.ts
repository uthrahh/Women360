import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "@/config/env";
import { requestLogger } from "@/middleware/requestLogger";
import { apiRateLimiter } from "@/middleware/rateLimit";
import { errorHandler } from "@/middleware/errorHandler";
import { notFoundHandler } from "@/middleware/notFound";
import { router } from "@/modules/router";
import { trackUsage } from "@/modules/usage/usage.middleware";
import { idempotency } from "@/middleware/idempotency";
import { prisma } from "@/lib/prisma";
import { alertAdmin } from "@/lib/alerts";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1); // needed for correct req.ip behind a cloud load balancer

  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(requestLogger);
  app.use(apiRateLimiter);
  app.use(trackUsage);

  app.get("/health", async (_req, res) => {
    // Unauthenticated probe for the hosting platform and for an uptime monitor. It asks the database a
    // trivial question, so "healthy" means the API AND its database are answering (a paused or
    // unreachable database is a 503 the monitor can see), and the query also keeps an idle free-tier
    // database awake. It reveals nothing beyond up or down.
    // Cross-origin on purpose: the web pages call this in the background to wake a sleeping
    // server, and the same-origin default from helmet would make browsers report it as an error.
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Cache-Control", "no-store");
    try {
      await Promise.race([
        prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) => setTimeout(() => reject(new Error("database did not answer within 4 seconds")), 4000).unref()),
      ]);
      res.status(200).json({ ok: true, data: { status: "healthy" } });
    } catch (err) {
      void alertAdmin("database-down", "The database is not answering", { what: err instanceof Error ? err.message.slice(0, 300) : "unknown" });
      res.status(503).json({ ok: false, data: { status: "unhealthy" } });
    }
  });

  app.use("/api/v1", idempotency, router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
