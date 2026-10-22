import type { NextFunction, Request, Response } from "express";
import { ForbiddenError } from "@/lib/errors";

/**
 * The published demonstration accounts (User.isDemo) can look around but not
 * lock anyone out or change shared settings. `forbidDemo` refuses the route
 * outright (changing the password, deleting the account, two-factor, signing
 * out everywhere); `blockDemoWrites` lets reads through and refuses anything
 * that changes data, for the demo administrator.
 */
export function forbidDemo(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.isDemo) return next(new ForbiddenError("This is a shared demonstration account, so this isn't available on it."));
  return next();
}

export function blockDemoWrites(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.isDemo && !["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next(new ForbiddenError("The demonstration administrator is read-only."));
  }
  return next();
}
