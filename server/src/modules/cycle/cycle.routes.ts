import { Router } from "express";
import { asyncHandler } from "@/lib/asyncHandler";
import { validate } from "@/middleware/validate";
import { requireAuth } from "@/middleware/auth";
import { ok, noContent } from "@/lib/response";
import { cycleService } from "./cycle.service";
import {
  cycleEntrySchema,
  cycleProfileSchema,
  dateParamSchema,
  listQuerySchema,
  phaseCalendarQuerySchema,
  summaryQuerySchema,
} from "./cycle.validation";

export const cycleRouter = Router();
cycleRouter.use(requireAuth);

cycleRouter.get(
  "/summary",
  validate({ query: summaryQuerySchema }),
  asyncHandler(async (req, res) =>
    ok(res, await cycleService.getSummary(req.user!.id, req.query.today as string | undefined))
  )
);

cycleRouter.get(
  "/entries",
  validate({ query: listQuerySchema }),
  asyncHandler(async (req, res) =>
    ok(res, await cycleService.listEntries(req.user!.id, req.query as { from?: string; to?: string }))
  )
);

cycleRouter.get(
  "/phase-calendar",
  validate({ query: phaseCalendarQuerySchema }),
  asyncHandler(async (req, res) => {
    const { from, to, today } = req.query as { from: string; to: string; today?: string };
    return ok(res, await cycleService.getPhaseCalendar(req.user!.id, from, to, today));
  })
);

cycleRouter.put(
  "/entries/:date",
  validate({ params: dateParamSchema, body: cycleEntrySchema.omit({ date: true }) }),
  asyncHandler(async (req, res) => {
    const entry = await cycleService.upsertEntry(req.user!.id, {
      date: req.params.date,
      ...req.body,
    });
    return ok(res, entry);
  })
);

cycleRouter.delete(
  "/entries/:date",
  validate({ params: dateParamSchema }),
  asyncHandler(async (req, res) => {
    await cycleService.deleteEntry(req.user!.id, req.params.date);
    return noContent(res);
  })
);

cycleRouter.get(
  "/profile",
  asyncHandler(async (req, res) => ok(res, await cycleService.getProfile(req.user!.id)))
);

cycleRouter.put(
  "/profile",
  validate({ body: cycleProfileSchema }),
  asyncHandler(async (req, res) => ok(res, await cycleService.upsertProfile(req.user!.id, req.body)))
);
