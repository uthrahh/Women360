import { Router } from "express";
import { asyncHandler } from "@/lib/asyncHandler";
import { validate } from "@/middleware/validate";
import { requireAuth } from "@/middleware/auth";
import { created, noContent, ok } from "@/lib/response";
import { activityService } from "./activity.service";
import { planService } from "./plan/plan.service";
import { planIdParamSchema, planRequestSchema, todayQuerySchema } from "./plan/plan.validation";
import {
  activityEntrySchema,
  activityEntryUpdateSchema,
  activityGoalSchema,
  idParamSchema,
  quickLogSchema,
  stepsLogSchema,
} from "./activity.validation";

export const activityRouter = Router();
activityRouter.use(requireAuth);

activityRouter.get(
  "/catalog",
  asyncHandler(async (_req, res) => ok(res, activityService.catalog()))
);

activityRouter.get(
  "/summary",
  asyncHandler(async (req, res) => ok(res, await activityService.getSummary(req.user!.id)))
);

activityRouter.post(
  "/entries",
  validate({ body: activityEntrySchema }),
  asyncHandler(async (req, res) => created(res, await activityService.addEntry(req.user!.id, req.body)))
);

activityRouter.patch(
  "/entries/:id",
  validate({ params: idParamSchema, body: activityEntryUpdateSchema }),
  asyncHandler(async (req, res) => ok(res, await activityService.updateEntry(req.user!.id, req.params.id, req.body)))
);

activityRouter.get(
  "/quick-log",
  asyncHandler(async (req, res) => ok(res, await activityService.listQuickLog(req.user!.id)))
);

activityRouter.post(
  "/quick-log",
  validate({ body: quickLogSchema }),
  asyncHandler(async (req, res) => created(res, await activityService.addQuickLog(req.user!.id, req.body)))
);

activityRouter.delete(
  "/quick-log/:id",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    await activityService.removeQuickLog(req.user!.id, req.params.id);
    return noContent(res);
  })
);

activityRouter.delete(
  "/entries/:id",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    await activityService.deleteEntry(req.user!.id, req.params.id);
    return noContent(res);
  })
);

activityRouter.post(
  "/steps",
  validate({ body: stepsLogSchema }),
  asyncHandler(async (req, res) => ok(res, await activityService.logSteps(req.user!.id, req.body)))
);

activityRouter.put(
  "/goal",
  validate({ body: activityGoalSchema }),
  asyncHandler(async (req, res) => ok(res, await activityService.upsertGoal(req.user!.id, req.body)))
);

// Personalised plans: built from her own data on request, saved only when she starts one.
activityRouter.get(
  "/plan/options",
  validate({ query: todayQuerySchema }),
  asyncHandler(async (req, res) => ok(res, await planService.options(req.user!.id, String(req.query.today))))
);

activityRouter.post(
  "/plan/preview",
  validate({ body: planRequestSchema }),
  asyncHandler(async (req, res) => ok(res, await planService.preview(req.user!.id, req.body)))
);

activityRouter.get(
  "/plan/active",
  validate({ query: todayQuerySchema }),
  asyncHandler(async (req, res) => ok(res, await planService.active(req.user!.id, String(req.query.today))))
);

activityRouter.post(
  "/plan",
  validate({ body: planRequestSchema }),
  asyncHandler(async (req, res) => created(res, await planService.start(req.user!.id, req.body)))
);

activityRouter.post(
  "/plan/:id/end",
  validate({ params: planIdParamSchema }),
  asyncHandler(async (req, res) => {
    await planService.end(req.user!.id, req.params.id);
    return noContent(res);
  })
);
