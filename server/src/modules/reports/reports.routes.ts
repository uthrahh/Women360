import { Router } from "express";
import { asyncHandler } from "@/lib/asyncHandler";
import { validate } from "@/middleware/validate";
import { requireAuth } from "@/middleware/auth";
import { created, ok } from "@/lib/response";
import { reportsService } from "./reports.service";
import { generateReportSchema, idParamSchema } from "./reports.validation";

export const reportsRouter = Router();
reportsRouter.use(requireAuth);

reportsRouter.get(
  "/",
  asyncHandler(async (req, res) => ok(res, await reportsService.list(req.user!.id)))
);

reportsRouter.get(
  "/:id",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => ok(res, await reportsService.get(req.user!.id, req.params.id)))
);

reportsRouter.post(
  "/",
  validate({ body: generateReportSchema }),
  asyncHandler(async (req, res) => created(res, await reportsService.generate(req.user!.id, req.body)))
);
