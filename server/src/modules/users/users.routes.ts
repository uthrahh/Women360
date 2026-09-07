import { Router } from "express";
import { asyncHandler } from "@/lib/asyncHandler";
import { validate } from "@/middleware/validate";
import { requireAuth } from "@/middleware/auth";
import { ok } from "@/lib/response";
import { usersService } from "./users.service";
import {
  toggleSeniorEssentialSchema,
  updateEmergencyContactSchema,
  updateProfileSchema,
} from "./users.validation";
import { z } from "zod";

export const usersRouter = Router();
usersRouter.use(requireAuth);

usersRouter.patch(
  "/me",
  validate({ body: updateProfileSchema }),
  asyncHandler(async (req, res) => {
    const user = await usersService.updateProfile(req.user!.id, req.body);
    return ok(res, user);
  })
);

usersRouter.get(
  "/me/emergency-contact",
  asyncHandler(async (req, res) => {
    const contact = await usersService.getEmergencyContact(req.user!.id);
    return ok(res, contact);
  })
);

usersRouter.put(
  "/me/emergency-contact",
  validate({ body: updateEmergencyContactSchema }),
  asyncHandler(async (req, res) => {
    const contact = await usersService.upsertEmergencyContact(req.user!.id, req.body);
    return ok(res, contact);
  })
);

usersRouter.get(
  "/me/senior-essentials",
  asyncHandler(async (req, res) => {
    const essentials = await usersService.listSeniorEssentials(req.user!.id);
    return ok(res, essentials);
  })
);

usersRouter.patch(
  "/me/senior-essentials",
  validate({ body: toggleSeniorEssentialSchema }),
  asyncHandler(async (req, res) => {
    const essential = await usersService.toggleSeniorEssential(
      req.user!.id,
      req.body.key,
      req.body.enabled
    );
    return ok(res, essential);
  })
);

usersRouter.get(
  "/me/health-profile",
  asyncHandler(async (req, res) => {
    const profile = await usersService.getHealthProfile(req.user!.id);
    return ok(res, profile);
  })
);

const healthProfileSchema = z.object({
  allergies: z.array(z.string().trim().min(1)).max(50).optional(),
  conditions: z.array(z.string().trim().min(1)).max(50).optional(),
  familyHistory: z.string().trim().max(2000).optional(),
  notes: z.string().trim().max(2000).optional(),
});

usersRouter.put(
  "/me/health-profile",
  validate({ body: healthProfileSchema }),
  asyncHandler(async (req, res) => {
    const profile = await usersService.upsertHealthProfile(req.user!.id, req.body);
    return ok(res, profile);
  })
);
