import { Router } from "express";
import { asyncHandler } from "@/lib/asyncHandler";
import { requireAuth } from "@/middleware/auth";
import { ok } from "@/lib/response";
import { insightsService } from "./insights.service";
import { requireClinicalContent } from "@/middleware/clinicalGate";

export const insightsRouter = Router();
insightsRouter.use(requireAuth);

insightsRouter.get(
  "/",
  asyncHandler(async (req, res) => ok(res, await insightsService.getInsights(req.user!.id)))
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
