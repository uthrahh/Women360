import { Router } from "express";
import { asyncHandler } from "@/lib/asyncHandler";
import { requireAuth } from "@/middleware/auth";
import { ok } from "@/lib/response";
import { insightsService } from "./insights.service";

export const insightsRouter = Router();
insightsRouter.use(requireAuth);

insightsRouter.get(
  "/",
  asyncHandler(async (req, res) => ok(res, await insightsService.getInsights(req.user!.id)))
);
