import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "@/lib/asyncHandler";
import { validate } from "@/middleware/validate";
import { requireAuth } from "@/middleware/auth";
import { ok } from "@/lib/response";
import { notificationsService } from "./notifications.service";

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get(
  "/",
  asyncHandler(async (req, res) => ok(res, await notificationsService.list(req.user!.id)))
);

notificationsRouter.patch(
  "/:id/read",
  validate({ params: z.object({ id: z.string().min(1) }) }),
  asyncHandler(async (req, res) => ok(res, await notificationsService.markRead(req.user!.id, req.params.id)))
);
