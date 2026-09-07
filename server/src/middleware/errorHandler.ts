import type { NextFunction, Request, Response } from "express";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { env } from "@/config/env";

// Human, specific error messages — never a bare "Error 500". Unknown
// errors are logged with detail server-side but never leak internals
// (stack traces, SQL, file paths) to the client.
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    if (err.status >= 500) {
      logger.error({ err, path: req.path }, err.message);
    }
    return res.status(err.status).json({
      ok: false,
      error: { code: err.code, message: err.message, details: err.details },
    });
  }

  logger.error({ err, path: req.path }, "Unhandled error");
  return res.status(500).json({
    ok: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "Something went wrong on our end. Please try again.",
      ...(env.isProduction ? {} : { debug: err instanceof Error ? err.message : String(err) }),
    },
  });
}
