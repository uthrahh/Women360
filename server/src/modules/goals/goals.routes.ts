import { Router } from "express";
import { asyncHandler } from "@/lib/asyncHandler";
import { validate } from "@/middleware/validate";
import { requireAuth } from "@/middleware/auth";
import { created, noContent, ok } from "@/lib/response";
import { goalsService } from "./goals.service";
import { createGoalSchema, idParamSchema, updateGoalSchema } from "./goals.validation";

export const goalsRouter = Router();
goalsRouter.use(requireAuth);

goalsRouter.get(
  "/",
  asyncHandler(async (req, res) => ok(res, await goalsService.list(req.user!.id)))
);

goalsRouter.post(
  "/",
  validate({ body: createGoalSchema }),
  asyncHandler(async (req, res) => created(res, await goalsService.create(req.user!.id, req.body)))
);

goalsRouter.patch(
  "/:id",
  validate({ params: idParamSchema, body: updateGoalSchema }),
  asyncHandler(async (req, res) => ok(res, await goalsService.update(req.user!.id, req.params.id, req.body)))
);

goalsRouter.delete(
  "/:id",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    await goalsService.remove(req.user!.id, req.params.id);
    return noContent(res);
  })
);
