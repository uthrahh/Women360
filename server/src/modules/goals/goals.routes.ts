import { Router } from "express";
import { asyncHandler } from "@/lib/asyncHandler";
import { validate } from "@/middleware/validate";
import { requireAuth } from "@/middleware/auth";
import { created, noContent, ok } from "@/lib/response";
import { goalsService } from "./goals.service";
import {
  checkInBodySchema,
  checkInParamSchema,
  createGoalSchema,
  idParamSchema,
  listGoalsQuerySchema,
  updateGoalSchema,
} from "./goals.validation";

export const goalsRouter = Router();
goalsRouter.use(requireAuth);

goalsRouter.get(
  "/",
  validate({ query: listGoalsQuerySchema }),
  asyncHandler(async (req, res) => {
    const { today } = req.query as { today?: string };
    return ok(res, await goalsService.list(req.user!.id, today));
  })
);

goalsRouter.post(
  "/",
  validate({ body: createGoalSchema, query: listGoalsQuerySchema }),
  asyncHandler(async (req, res) => {
    const { today } = req.query as { today?: string };
    return created(res, await goalsService.create(req.user!.id, req.body, today));
  })
);

goalsRouter.patch(
  "/:id",
  validate({ params: idParamSchema, body: updateGoalSchema, query: listGoalsQuerySchema }),
  asyncHandler(async (req, res) => {
    const { today } = req.query as { today?: string };
    return ok(res, await goalsService.update(req.user!.id, req.params.id, req.body, today));
  })
);

goalsRouter.delete(
  "/:id",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    await goalsService.remove(req.user!.id, req.params.id);
    return noContent(res);
  })
);

goalsRouter.post(
  "/:id/check-ins",
  validate({ params: idParamSchema, body: checkInBodySchema }),
  asyncHandler(async (req, res) => ok(res, await goalsService.checkIn(req.user!.id, req.params.id, req.body.date)))
);

goalsRouter.delete(
  "/:id/check-ins/:date",
  validate({ params: checkInParamSchema }),
  asyncHandler(async (req, res) => ok(res, await goalsService.undoCheckIn(req.user!.id, req.params.id, req.params.date)))
);
