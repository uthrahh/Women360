import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "@/lib/asyncHandler";
import { validate } from "@/middleware/validate";
import { requireAuth } from "@/middleware/auth";
import { requireRole } from "@/middleware/rbac";
import { forbidDemo } from "@/middleware/demoGuard";
import { ok } from "@/lib/response";
import { isValidIsoDay } from "@/lib/streak";
import { advisorService } from "./advisor.service";

const isoDay = z.string().refine(isValidIsoDay, "Use a date in YYYY-MM-DD format.");

/** The health advisor: small preventive ideas from her own logs (and, when switched on and she agreed to share, from the AI), each addable as a habit or goal. */
export const advisorRouter = Router();
advisorRouter.use(requireAuth, requireRole("WOMAN"));

advisorRouter.get("/", validate({ query: z.object({ today: isoDay }) }), asyncHandler(async (req, res) => ok(res, await advisorService.ideas(req.user!.id, req.user!.isDemo, (req.query as { today: string }).today))));
// The AI costs real money and anyone can sign in to a demonstration account, so it is refused there, like the chat.
advisorRouter.post("/ai", forbidDemo, validate({ body: z.object({ today: isoDay }) }), asyncHandler(async (req, res) => ok(res, await advisorService.aiIdeas(req.user!.id, req.body.today))));
advisorRouter.post("/dismiss", validate({ body: z.object({ key: z.string().min(1).max(60) }) }), asyncHandler(async (req, res) => ok(res, await advisorService.dismiss(req.user!.id, req.body.key))));
