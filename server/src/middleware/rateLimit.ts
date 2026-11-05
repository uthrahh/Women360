import rateLimit from "express-rate-limit";
import type { NextFunction, Request, Response } from "express";
import { TooManyRequestsError } from "@/lib/errors";
import { env } from "@/config/env";

const handler = (_req: Request, _res: Response, next: NextFunction) => {
  next(new TooManyRequestsError());
};

// Tight limit on auth endpoints specifically, to blunt credential-stuffing
// and brute-force attempts without punishing normal API usage elsewhere.
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.AUTH_RATE_LIMIT_PER_15_MIN,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});

export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: env.API_RATE_LIMIT_PER_MINUTE,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});
