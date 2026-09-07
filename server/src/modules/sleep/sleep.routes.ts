import { Router } from "express";
import { asyncHandler } from "@/lib/asyncHandler";
import { validate } from "@/middleware/validate";
import { requireAuth } from "@/middleware/auth";
import { ok } from "@/lib/response";
import { sleepService } from "./sleep.service";
import { sleepEntrySchema } from "./sleep.validation";

export const sleepRouter = Router();
sleepRouter.use(requireAuth);

sleepRouter.get(
  "/summary",
  asyncHandler(async (req, res) => ok(res, await sleepService.getSummary(req.user!.id)))
);

sleepRouter.put(
  "/entries/:date",
  validate({ body: sleepEntrySchema.omit({ date: true }) }),
  asyncHandler(async (req, res) =>
    ok(res, await sleepService.upsertEntry(req.user!.id, { date: req.params.date, ...req.body }))
  )
);
