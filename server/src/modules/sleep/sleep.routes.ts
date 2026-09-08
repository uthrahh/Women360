import { Router } from "express";
import { asyncHandler } from "@/lib/asyncHandler";
import { validate } from "@/middleware/validate";
import { requireAuth } from "@/middleware/auth";
import { ok, noContent } from "@/lib/response";
import { sleepService } from "./sleep.service";
import { dateParamSchema, sleepEntrySchema } from "./sleep.validation";

export const sleepRouter = Router();
sleepRouter.use(requireAuth);

sleepRouter.get(
  "/summary",
  asyncHandler(async (req, res) => ok(res, await sleepService.getSummary(req.user!.id)))
);

sleepRouter.put(
  "/entries/:date",
  validate({ params: dateParamSchema, body: sleepEntrySchema.omit({ date: true }) }),
  asyncHandler(async (req, res) =>
    ok(res, await sleepService.upsertEntry(req.user!.id, { date: req.params.date, ...req.body }))
  )
);

sleepRouter.delete(
  "/entries/:date",
  validate({ params: dateParamSchema }),
  asyncHandler(async (req, res) => {
    await sleepService.deleteEntry(req.user!.id, req.params.date);
    return noContent(res);
  })
);
