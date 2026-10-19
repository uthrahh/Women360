import { Router } from "express";
import { asyncHandler } from "@/lib/asyncHandler";
import { validate } from "@/middleware/validate";
import { requireAuth } from "@/middleware/auth";
import { created, noContent, ok } from "@/lib/response";
import { habitsService } from "./habits.service";
import {
  createHabitSchema,
  habitDaySchema,
  habitIdSchema,
  habitQuerySchema,
  logBodySchema,
  updateHabitSchema,
} from "./habits.validation";

export const habitsRouter = Router();
habitsRouter.use(requireAuth);

// The person's own calendar day, sent by the client, decides what "today" means.
const todayOf = (req: { query: unknown }) => (req.query as { today?: string }).today;

habitsRouter.get(
  "/",
  validate({ query: habitQuerySchema }),
  asyncHandler(async (req, res) => ok(res, await habitsService.list(req.user!.id, todayOf(req))))
);

habitsRouter.post(
  "/",
  validate({ body: createHabitSchema, query: habitQuerySchema }),
  asyncHandler(async (req, res) => created(res, await habitsService.create(req.user!.id, req.body, todayOf(req))))
);

habitsRouter.patch(
  "/:id",
  validate({ params: habitIdSchema, body: updateHabitSchema, query: habitQuerySchema }),
  asyncHandler(async (req, res) => ok(res, await habitsService.update(req.user!.id, req.params.id, req.body, todayOf(req))))
);

habitsRouter.delete(
  "/:id",
  validate({ params: habitIdSchema }),
  asyncHandler(async (req, res) => {
    await habitsService.remove(req.user!.id, req.params.id);
    return noContent(res);
  })
);

habitsRouter.put(
  "/:id/logs/:date",
  validate({ params: habitDaySchema, body: logBodySchema }),
  asyncHandler(async (req, res) => ok(res, await habitsService.log(req.user!.id, req.params.id, req.params.date, req.body.amount)))
);

habitsRouter.delete(
  "/:id/logs/:date",
  validate({ params: habitDaySchema }),
  asyncHandler(async (req, res) => ok(res, await habitsService.unlog(req.user!.id, req.params.id, req.params.date)))
);
