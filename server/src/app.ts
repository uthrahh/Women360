import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "@/config/env";
import { requestLogger } from "@/middleware/requestLogger";
import { apiRateLimiter } from "@/middleware/rateLimit";
import { errorHandler } from "@/middleware/errorHandler";
import { notFoundHandler } from "@/middleware/notFound";
import { router } from "@/modules/router";

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

  app.get("/health", (_req, res) => {
    // Unauthenticated liveness/readiness probe for the hosting platform —
    // deliberately reveals nothing about the system beyond "it's up".
    res.status(200).json({ ok: true, data: { status: "healthy" } });
  });

  app.use("/api/v1", router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
