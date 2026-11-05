import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "@/lib/asyncHandler";
import { validate } from "@/middleware/validate";
import { requireAuth } from "@/middleware/auth";
import { noContent } from "@/lib/response";
import { SCREENS, countEvent, noteActive } from "./usage.service";

export const usageRouter = Router();
usageRouter.use(requireAuth);

// "She opened this screen." Sent by the app when a signed-in woman moves between screens, unless her browser
// says Do Not Track. Carries only the screen's name from a fixed list.
usageRouter.post(
  "/view",
  validate({ body: z.object({ screen: z.enum(SCREENS) }) }),
  asyncHandler(async (req, res) => {
    if (req.user!.role === "WOMAN" && !req.user!.isDemo) {
      await Promise.all([countEvent(`view:${req.body.screen}`), noteActive(req.user!.id)]);
    }
    return noContent(res);
  })
);
