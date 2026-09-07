import type { NextFunction, Request, Response } from "express";
import type { Role } from "@prisma/client";
import { verifyAccessToken } from "@/lib/jwt";
import { UnauthorizedError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

export interface AuthenticatedUser {
  id: string;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Verifies the bearer access token and attaches { id, role } to req.user.
 * Confirms the account still exists and isn't soft-deleted on every
 * request — a short-lived access token (15 min default) makes this cheap
 * enough to do unconditionally rather than trusting stale token claims.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new UnauthorizedError());
  }

  try {
    const payload = verifyAccessToken(header.slice("Bearer ".length));
    const user = await prisma.user.findFirst({
      where: { id: payload.sub, deletedAt: null },
      select: { id: true, role: true },
    });
    if (!user) return next(new UnauthorizedError());
    req.user = user;
    return next();
  } catch {
    return next(new UnauthorizedError("Your session has expired. Please sign in again."));
  }
}
