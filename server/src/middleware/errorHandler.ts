import type { NextFunction, Request, Response } from "express";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { env } from "@/config/env";
import { alertAdmin } from "@/lib/alerts";

function bodyParserError(err: unknown): { status: number; code: string; message: string } | null {
  if (!err || typeof err !== "object" || !("type" in err)) return null;
  switch ((err as { type?: unknown }).type) {
    case "entity.parse.failed":
      return { status: 400, code: "BAD_JSON", message: "The request couldn't be read. Please try again." };
    case "entity.too.large":
      return { status: 413, code: "TOO_LARGE", message: "That is too much to send at once." };
    case "encoding.unsupported":
    case "charset.unsupported":
      return { status: 415, code: "UNSUPPORTED", message: "The request couldn't be read. Please try again." };
    default:
      return null;
  }
}

// Human, specific error messages — never a bare "Error 500". Unknown
// errors are logged with detail server-side but never leak internals
// (stack traces, SQL, file paths) to the client.
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    if (err.status >= 500) {
      logger.error({ err, path: req.path }, err.message);
      void alertAdmin(`${err.status}:${req.method}:${req.path}`, `Server error ${err.status} on ${req.method} ${req.path}`, { what: err.message, requestId: res.getHeader("x-request-id")?.toString() });
    }
    return res.status(err.status).json({
      ok: false,
      error: { code: err.code, message: err.message, details: err.details },
    });
  }

  // A body the JSON reader couldn't take (broken JSON, too large, wrong encoding) is the sender's mistake, not ours:
  // answer 4xx, and never wake the administrator for it (anyone could otherwise trigger alert emails at will).
  const bodyError = bodyParserError(err);
  if (bodyError) {
    return res.status(bodyError.status).json({ ok: false, error: { code: bodyError.code, message: bodyError.message } });
  }

  logger.error({ err, path: req.path }, "Unhandled error");
  void alertAdmin(`500:${req.method}:${req.path}`, `Unhandled error on ${req.method} ${req.path}`, {
    what: err instanceof Error ? err.message.slice(0, 300) : "non-error thrown",
    requestId: res.getHeader("x-request-id")?.toString(),
  });
  return res.status(500).json({
    ok: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "Something went wrong on our end. Please try again.",
      ...(env.isProduction ? {} : { debug: err instanceof Error ? err.message : String(err) }),
    },
  });
}
