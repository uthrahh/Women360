import { Router } from "express";
import { asyncHandler } from "@/lib/asyncHandler";
import { validate } from "@/middleware/validate";
import { requireAuth } from "@/middleware/auth";
import { requireRole } from "@/middleware/rbac";
import { created, noContent, ok } from "@/lib/response";
import { learnService } from "./learn.service";
import { createArticleSchema, idParamSchema, updateArticleSchema } from "./learn.validation";

export const learnRouter = Router();
learnRouter.use(requireAuth);

learnRouter.get(
  "/",
  asyncHandler(async (req, res) =>
    ok(res, req.user!.role === "ADMIN" ? await learnService.listAll() : await learnService.listPublished())
  )
);

learnRouter.get(
  "/:id",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => ok(res, await learnService.get(req.params.id)))
);

learnRouter.post(
  "/",
  requireRole("ADMIN"),
  validate({ body: createArticleSchema }),
  asyncHandler(async (req, res) => created(res, await learnService.create(req.body)))
);

learnRouter.patch(
  "/:id",
  requireRole("ADMIN"),
  validate({ params: idParamSchema, body: updateArticleSchema }),
  asyncHandler(async (req, res) => ok(res, await learnService.update(req.params.id, req.body)))
);

learnRouter.delete(
  "/:id",
  requireRole("ADMIN"),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    await learnService.remove(req.params.id);
    return noContent(res);
  })
);
