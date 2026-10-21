import { Router } from "express";
import { asyncHandler } from "@/lib/asyncHandler";
import { validate } from "@/middleware/validate";
import { requireAuth } from "@/middleware/auth";
import { created, noContent, ok } from "@/lib/response";
import { activityService } from "./activity.service";
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
