import { Router } from "express";
import { env } from "@/config/env";
import { clinicalContentOn } from "@/config/features";
import { asyncHandler } from "@/lib/asyncHandler";
import { ok } from "@/lib/response";

export const configRouter = Router();

// What the web app needs to know before anyone signs in: which features are switched on and
// where to write for help. Nothing secret, and nothing about any person.
configRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=60");
    return ok(res, {
      clinicalContent: clinicalContentOn(),
      // Present only when reminders can reach her while the app is closed.
      pushPublicKey: env.pushConfigured ? env.VAPID_PUBLIC_KEY : null,
      supportEmail: env.SUPPORT_EMAIL ?? null,
    });
  })
);
