import { Router } from "express";
import { asyncHandler } from "@/lib/asyncHandler";
import { validate } from "@/middleware/validate";
import { requireAuth } from "@/middleware/auth";
import { ok } from "@/lib/response";
import { wellbeingService } from "./wellbeing.service";
import { wellbeingEntrySchema } from "./wellbeing.validation";

export const wellbeingRouter = Router();
wellbeingRouter.use(requireAuth);

wellbeingRouter.get(
  "/entries",
  asyncHandler(async (req, res) => ok(res, await wellbeingService.listRecent(req.user!.id)))
);

wellbeingRouter.put(
  "/entries/:date",
  validate({ body: wellbeingEntrySchema.omit({ date: true }) }),
  asyncHandler(async (req, res) =>
    ok(res, await wellbeingService.upsertEntry(req.user!.id, { date: req.params.date, ...req.body }))
  )
);
