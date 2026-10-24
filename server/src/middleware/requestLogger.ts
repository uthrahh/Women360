import { randomUUID } from "node:crypto";
import pinoHttp from "pino-http";
import { logger } from "@/lib/logger";

export const requestLogger = pinoHttp({
  logger,
  autoLogging: true,
  // Always generated here, never taken from the client, so it can't be forged into the logs.
  genReqId: (_req, res) => {
    const id = randomUUID();
    res.setHeader("X-Request-Id", id);
    return id;
  },
  customSuccessMessage: (req, res) => `${req.method} ${req.url} -> ${res.statusCode}`,
  // Never log headers/body by default — see logger.ts redact list.
  serializers: {
    req: (req) => ({ id: req.id, method: req.method, url: req.url }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
});
