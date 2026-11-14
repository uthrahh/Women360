import { Router } from "express";
import { asyncHandler } from "@/lib/asyncHandler";
import { requireAuth } from "@/middleware/auth";
import { ok } from "@/lib/response";
import { insightsService } from "./insights.service";
import { requireClinicalContent } from "@/middleware/clinicalGate";
import { z } from "zod";
import { validate } from "@/middleware/validate";
import { assertPlausibleDay } from "@/lib/days";
import { dailySeries } from "./daily";

export const insightsRouter = Router();
insightsRouter.use(requireAuth);

insightsRouter.get(
  "/",
  asyncHandler(async (req, res) => ok(res, await insightsService.getInsights(req.user!.id)))
);

// Her logs side by side, one row per day, for the "See it together" chart. `today` is her own calendar day.
insightsRouter.get(
  "/daily",
  validate({ query: z.object({ days: z.coerce.number().int().refine((d) => d === 30 || d === 90, "30 or 90"), today: z.string().date() }) }),
  asyncHandler(async (req, res) => {
    const { days, today } = req.query as unknown as { days: number; today: string };
    assertPlausibleDay(today);
    return ok(res, await dailySeries(req.user!.id, days, today));
  })
);

insightsRouter.get(
  "/cycle-delay",
  requireClinicalContent,
  asyncHandler(async (req, res) => ok(res, await insightsService.explainCycleDelay(req.user!.id)))
);

insightsRouter.get(
  "/low-mood",
  requireClinicalContent,
  asyncHandler(async (req, res) => ok(res, await insightsService.explainLowMood(req.user!.id)))
);
