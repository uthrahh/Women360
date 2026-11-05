import type { NextFunction, Request, Response } from "express";
import { clinicalContentOn } from "@/config/features";
import { NotFoundError } from "@/lib/errors";

/** Refuses a route that belongs to the clinical-review features while they are switched off. */
export function requireClinicalContent(_req: Request, _res: Response, next: NextFunction) {
  if (!clinicalContentOn()) return next(new NotFoundError("This isn't available yet."));
  return next();
}
