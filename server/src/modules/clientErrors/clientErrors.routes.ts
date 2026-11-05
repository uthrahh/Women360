import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { asyncHandler } from "@/lib/asyncHandler";
import { validate } from "@/middleware/validate";
import { noContent } from "@/lib/response";
import { alertAdmin } from "@/lib/alerts";
import { logger } from "@/lib/logger";

export const clientErrorsRouter = Router();

// Crashes in someone's browser, reported without signing in (the crash may be the sign-in screen).
// Anonymous by design: no account, no IP stored, no page content, and only a short technical message
// and the screen it happened on. Tightly limited so it can't be used to flood the logs or the inbox.
const limiter = rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: true, legacyHeaders: false, handler: (_req, res) => void res.status(204).end() });

const reportSchema = z.object({
  kind: z.enum(["render", "unhandled"]),
  message: z.string().trim().min(1).max(200),
  // The screen, as a path with anything that looks like an id replaced by ":id".
  route: z.string().trim().max(120).regex(/^\/[A-Za-z0-9\-_/:]*$/),
});

clientErrorsRouter.post(
  "/",
  limiter,
  validate({ body: reportSchema }),
  asyncHandler(async (req, res) => {
    const { kind, message, route } = req.body as z.infer<typeof reportSchema>;
    logger.warn({ kind, route, message }, "Browser error reported");
    void alertAdmin(`client:${kind}:${route}:${message.slice(0, 60)}`, `A screen crashed in someone's browser (${route})`, { kind, route, what: message });
    return noContent(res);
  })
);
