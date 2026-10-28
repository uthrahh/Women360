import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "@/lib/asyncHandler";
import { validate } from "@/middleware/validate";
import { requireAuth } from "@/middleware/auth";
import { noContent, ok } from "@/lib/response";
import { conditionsService } from "./conditions.service";
import { CONDITION_CODES, SIGNALS } from "./guidelines";

export const conditionsRouter = Router();
conditionsRouter.use(requireAuth);

const declaredSchema = z.object({ conditions: z.array(z.enum(CONDITION_CODES)).max(CONDITION_CODES.length) });
const todayQuery = z.object({ today: z.string().date() });
const keyParam = z.object({ key: z.enum(Object.keys(SIGNALS) as [string, ...string[]]) });

conditionsRouter.get(
  "/",
  asyncHandler(async (req, res) => ok(res, await conditionsService.list(req.user!.id)))
);

conditionsRouter.put(
  "/",
  validate({ body: declaredSchema }),
  asyncHandler(async (req, res) => ok(res, await conditionsService.setDeclared(req.user!.id, req.body.conditions)))
);

conditionsRouter.get(
  "/signals",
  validate({ query: todayQuery }),
  asyncHandler(async (req, res) => ok(res, await conditionsService.signals(req.user!.id, String(req.query.today))))
);

conditionsRouter.post(
  "/signals/:key/dismiss",
  validate({ params: keyParam }),
  asyncHandler(async (req, res) => {
    await conditionsService.dismiss(req.user!.id, req.params.key);
    return noContent(res);
  })
);
