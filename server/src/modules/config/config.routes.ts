import { Router } from "express";
import { env } from "@/config/env";
import { clinicalContentOn } from "@/config/features";
import { chatConfigured, chatEnabled } from "@/modules/chat/chat.config";
import { asyncHandler } from "@/lib/asyncHandler";
import { ok } from "@/lib/response";
import { prisma } from "@/lib/prisma";

export const configRouter = Router();

// What the web app needs to know before anyone signs in: which features are switched on and
// where to write for help. Nothing secret, and nothing about any person.
configRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    // Programme appears in the menu only when there is one to join or someone is in one (the sample programme for the
    // demonstration accounts doesn't count: the web app shows it to those accounts itself).
    const programmes =
      (await prisma.programme.count({ where: { status: "PUBLISHED", demoOnly: false } })) > 0 ||
      (await prisma.enrolment.count({ where: { status: { notIn: ["COMPLETED", "LEFT"] }, user: { isDemo: false } } })) > 0;
    res.setHeader("Cache-Control", "public, max-age=60");
    return ok(res, {
      clinicalContent: clinicalContentOn(),
      // Present only when reminders can reach her while the app is closed.
      pushPublicKey: env.pushConfigured ? env.VAPID_PUBLIC_KEY : null,
      supportEmail: env.SUPPORT_EMAIL ?? null,
      // The AI chat appears only when the owner has switched it on and it can actually answer.
      chatbot: chatEnabled() && chatConfigured(),
      // Only ask people to confirm their address when an email can actually reach them.
      emailVerification: env.mailConfigured,
      programmes,
    });
  })
);
