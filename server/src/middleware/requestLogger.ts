import pinoHttp from "pino-http";
import { logger } from "@/lib/logger";

export const requestLogger = pinoHttp({
  logger,
  autoLogging: true,
  customSuccessMessage: (req, res) => `${req.method} ${req.url} -> ${res.statusCode}`,
  // Never log headers/body by default — see logger.ts redact list.
  serializers: {
    req: (req) => ({ method: req.method, url: req.url }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
});
