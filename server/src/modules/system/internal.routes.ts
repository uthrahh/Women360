import { Router } from "express";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { asyncHandler } from "@/lib/asyncHandler";
import { validate } from "@/middleware/validate";
import { NotFoundError, UnauthorizedError } from "@/lib/errors";
import { env } from "@/config/env";
import { noContent } from "@/lib/response";
import { recordBackupReport } from "./system.service";

export const internalRouter = Router();

function tokenMatches(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Called by the nightly backup job once a backup has been restored and checked, so the administrator's status
// panel can show it. Needs BACKUP_REPORT_TOKEN on the server; without one the route does not exist.
internalRouter.post(
  "/backup-report",
  validate({ body: z.object({ tables: z.number().int().min(1).max(10_000), rows: z.number().int().min(0).max(1_000_000_000) }) }),
  asyncHandler(async (req, res) => {
    if (!env.BACKUP_REPORT_TOKEN) throw new NotFoundError();
    const header = req.headers.authorization ?? "";
    if (!header.startsWith("Bearer ") || !tokenMatches(header.slice(7), env.BACKUP_REPORT_TOKEN)) throw new UnauthorizedError();
    await recordBackupReport(req.body.tables, req.body.rows);
    return noContent(res);
  })
);
