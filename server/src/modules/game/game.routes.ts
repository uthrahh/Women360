import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "@/lib/asyncHandler";
import { validate } from "@/middleware/validate";
import { requireAuth } from "@/middleware/auth";
import { requireRole } from "@/middleware/rbac";
import { ok } from "@/lib/response";
import { isValidIsoDay } from "@/lib/streak";
import { gameService } from "./game.service";

const todayQuery = z.object({ today: z.string().refine(isValidIsoDay, "Use a date in YYYY-MM-DD format.") });

/** Game mode: her level, points, run of active days, today's quests and badges, all worked out from her logs. Turned on and off in her profile. */
export const gameRouter = Router();
gameRouter.use(requireAuth, requireRole("WOMAN"));

gameRouter.get("/", validate({ query: todayQuery }), asyncHandler(async (req, res) => ok(res, await gameService.state(req.user!.id, (req.query as { today: string }).today))));
gameRouter.post(
  "/seen",
  validate({ body: z.object({ level: z.number().int().min(1).max(1000) }) }),
  asyncHandler(async (req, res) => ok(res, await gameService.seen(req.user!.id, req.body.level)))
);
