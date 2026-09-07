import type { NextFunction, Request, Response } from "express";
import type { Role } from "@prisma/client";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";

/**
 * Server-side role gate. The frontend hides navigation by role for UX, but
 * every protected resource must also enforce this here — a user must never
 * be able to reach another role's data simply by calling the API directly.
 */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new UnauthorizedError());
    if (!roles.includes(req.user.role)) return next(new ForbiddenError());
    return next();
  };
}
