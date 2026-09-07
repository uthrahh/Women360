import { Router } from "express";
import { asyncHandler } from "@/lib/asyncHandler";
import { validate } from "@/middleware/validate";
import { requireAuth } from "@/middleware/auth";
import { ok } from "@/lib/response";
import { messagesService } from "./messages.service";
import { idParamSchema } from "./messages.validation";

export const messagesRouter = Router();
messagesRouter.use(requireAuth);

messagesRouter.get(
  "/",
  asyncHandler(async (req, res) => ok(res, await messagesService.list(req.user!.id)))
);

messagesRouter.patch(
  "/:id/read",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => ok(res, await messagesService.markRead(req.user!.id, req.params.id)))
);
