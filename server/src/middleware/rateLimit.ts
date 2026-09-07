import rateLimit from "express-rate-limit";
import type { NextFunction, Request, Response } from "express";
import { TooManyRequestsError } from "@/lib/errors";

const handler = (_req: Request, _res: Response, next: NextFunction) => {
  next(new TooManyRequestsError());
};

// Tight limit on auth endpoints specifically, to blunt credential-stuffing
// and brute-force attempts without punishing normal API usage elsewhere.
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});

export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});
