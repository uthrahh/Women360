import { Router } from "express";
import { asyncHandler } from "@/lib/asyncHandler";
import { validate } from "@/middleware/validate";
import { requireAuth } from "@/middleware/auth";
import { created, noContent, ok } from "@/lib/response";
import { nutritionService } from "./nutrition.service";
import {
  dateQuerySchema,
  hydrationLogSchema,
  idParamSchema,
  mealEntrySchema,
  nutritionGoalSchema,
} from "./nutrition.validation";

export const nutritionRouter = Router();
nutritionRouter.use(requireAuth);

nutritionRouter.get(
  "/today",
  validate({ query: dateQuerySchema }),
  asyncHandler(async (req, res) => {
    const summary = await nutritionService.getDailySummary(
      req.user!.id,
      req.query.date as string | undefined
    );
    return ok(res, summary);
  })
);

nutritionRouter.post(
  "/meals",
  validate({ body: mealEntrySchema }),
  asyncHandler(async (req, res) => created(res, await nutritionService.addMeal(req.user!.id, req.body)))
);

nutritionRouter.delete(
  "/meals/:id",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    await nutritionService.deleteMeal(req.user!.id, req.params.id);
    return noContent(res);
  })
);

nutritionRouter.post(
  "/hydration",
  validate({ body: hydrationLogSchema }),
  asyncHandler(async (req, res) => created(res, await nutritionService.logHydration(req.user!.id, req.body)))
);

nutritionRouter.get(
  "/goal",
  asyncHandler(async (req, res) => ok(res, await nutritionService.getGoal(req.user!.id)))
);

nutritionRouter.put(
  "/goal",
  validate({ body: nutritionGoalSchema }),
  asyncHandler(async (req, res) => ok(res, await nutritionService.upsertGoal(req.user!.id, req.body)))
);
