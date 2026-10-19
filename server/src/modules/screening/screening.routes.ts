import { Router } from "express";
import { asyncHandler } from "@/lib/asyncHandler";
import { validate } from "@/middleware/validate";
import { requireAuth } from "@/middleware/auth";
import { noContent, ok } from "@/lib/response";
import { screeningService } from "./screening.service";
import { recordBodySchema, screeningIdSchema, screeningQuerySchema, screeningRecordIdSchema } from "./screening.validation";

export const screeningRouter = Router();
screeningRouter.use(requireAuth);

screeningRouter.get(
  "/",
  validate({ query: screeningQuerySchema }),
  asyncHandler(async (req, res) => ok(res, await screeningService.list(req.user!.id, (req.query as { today?: string }).today)))
);

// "I had this done on <date>". The latest record decides when it's next due.
screeningRouter.post(
  "/:id/records",
  validate({ params: screeningIdSchema, body: recordBodySchema, query: screeningQuerySchema }),
  asyncHandler(async (req, res) => {
    await screeningService.record(req.user!.id, req.params.id, req.body.doneOn);
    return ok(res, await screeningService.list(req.user!.id, (req.query as { today?: string }).today));
  })
);

screeningRouter.delete(
  "/:id/records/:recordId",
  validate({ params: screeningRecordIdSchema }),
  asyncHandler(async (req, res) => {
    await screeningService.removeRecord(req.user!.id, req.params.id, req.params.recordId);
    return noContent(res);
  })
);
