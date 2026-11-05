import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "@/lib/asyncHandler";
import { validate } from "@/middleware/validate";
import { requireAuth } from "@/middleware/auth";
import { forbidDemo } from "@/middleware/demoGuard";
import { BadRequestError } from "@/lib/errors";
import { env } from "@/config/env";
import { noContent, ok } from "@/lib/response";
import { prisma } from "@/lib/prisma";
import { isKnownTimeZone, isTrustedPushEndpoint } from "./schedule";

export const pushRouter = Router();
pushRouter.use(requireAuth);

const MAX_DEVICES = 10;

const subscribeSchema = z.object({
  endpoint: z.string().url().max(2048).refine(isTrustedPushEndpoint, "That isn't a push service this app can use."),
  keys: z.object({ p256dh: z.string().min(1).max(256), auth: z.string().min(1).max(128) }),
  timezone: z.string().max(64).refine(isKnownTimeZone, "Unknown time zone."),
});

// Registers (or refreshes) this device. Calling it again with the same endpoint just updates the time zone
// and moves the device to whoever is signed in now, so a shared browser never reminds the wrong person.
// Not for the shared demonstration accounts: a device would then get reminders about someone else's use.
pushRouter.post(
  "/subscribe",
  forbidDemo,
  validate({ body: subscribeSchema }),
  asyncHandler(async (req, res) => {
    if (!env.pushConfigured) throw new BadRequestError("Reminders when the app is closed aren't switched on yet.");
    const { endpoint, keys, timezone } = req.body as z.infer<typeof subscribeSchema>;
    const userId = req.user!.id;
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: { userId, endpoint, p256dh: keys.p256dh, auth: keys.auth, timezone },
      update: { userId, p256dh: keys.p256dh, auth: keys.auth, timezone },
    });
    // Keep only the newest few devices.
    const mine = await prisma.pushSubscription.findMany({ where: { userId }, orderBy: { updatedAt: "desc" }, select: { id: true } });
    if (mine.length > MAX_DEVICES) await prisma.pushSubscription.deleteMany({ where: { id: { in: mine.slice(MAX_DEVICES).map((s) => s.id) } } });
    return ok(res, { subscribed: true });
  })
);

// Stops reminders on one device. Only her own device can be removed.
pushRouter.post(
  "/unsubscribe",
  validate({ body: z.object({ endpoint: z.string().min(1).max(2048) }) }),
  asyncHandler(async (req, res) => {
    await prisma.pushSubscription.deleteMany({ where: { userId: req.user!.id, endpoint: req.body.endpoint } });
    return noContent(res);
  })
);
