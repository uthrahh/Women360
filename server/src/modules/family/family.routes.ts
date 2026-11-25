import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "@/lib/asyncHandler";
import { validate } from "@/middleware/validate";
import { requireAuth } from "@/middleware/auth";
import { requireRole } from "@/middleware/rbac";
import { forbidDemo } from "@/middleware/demoGuard";
import { ForbiddenError } from "@/lib/errors";
import { created, noContent, ok } from "@/lib/response";
import { familyService } from "./family.service";
import { usersService } from "@/modules/users/users.service";
import { isValidIsoDay } from "@/lib/streak";

const isoDay = z.string().refine(isValidIsoDay, "Use a date in YYYY-MM-DD format.");
const id = z.object({ id: z.string().min(1).max(40) });
const level = z.enum(["MONITOR", "MODIFY"]);
const profileBody = z.object({
  name: z.string().trim().min(1).max(80),
  dateOfBirth: isoDay,
  relation: z.string().trim().max(40).nullable().optional().transform((v) => v || null),
  cycleTracking: z.boolean(),
  guardianConfirmed: z.boolean().optional(),
});
const profileUpdate = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  dateOfBirth: isoDay.optional(),
  relation: z.string().trim().max(40).nullable().optional().transform((v) => (v === undefined ? undefined : v || null)),
  cycleTracking: z.boolean().optional(),
  guardianConfirmed: z.boolean().optional(),
});
const emailBody = z.object({ email: z.string().trim().email().max(200) });

/** Family: profiles she keeps for others, and access between accounts. Her own family settings only, never while acting for someone. */
export const familyRouter = Router();
familyRouter.use(requireAuth, requireRole("WOMAN"), (req, _res, next) => {
  // A managed profile never signs in, but make sure family settings are never changed on someone else's behalf either.
  if (req.user!.actorId) return next(new ForbiddenError("Switch back to your own records to manage family access."));
  return next();
});

familyRouter.get("/", asyncHandler(async (req, res) => ok(res, await familyService.overview(req.user!.id))));
familyRouter.post("/open/:id", validate({ params: id }), asyncHandler(async (req, res) => ok(res, await familyService.open(req.user!.id, req.params.id))));

// The demonstration accounts can look at the screen but not link to real people or create profiles.
familyRouter.post("/profiles", forbidDemo, validate({ body: profileBody }), asyncHandler(async (req, res) => created(res, await familyService.createProfile(req.user!.id, req.body))));
familyRouter.patch("/profiles/:id", forbidDemo, validate({ params: id, body: profileUpdate }), asyncHandler(async (req, res) => ok(res, await familyService.updateProfile(req.user!.id, req.params.id, req.body))));
familyRouter.delete(
  "/profiles/:id",
  forbidDemo,
  validate({ params: id }),
  asyncHandler(async (req, res) => {
    await familyService.deleteProfile(req.user!.id, req.params.id);
    return noContent(res);
  })
);
// The manager can download everything kept in a profile, as she can for her own account.
familyRouter.get(
  "/profiles/:id/export",
  validate({ params: id }),
  asyncHandler(async (req, res) => {
    const p = await familyService.open(req.user!.id, req.params.id);
    if (p.access !== "MANAGE") throw new ForbiddenError();
    return ok(res, await usersService.exportData(req.params.id));
  })
);

familyRouter.post("/share", forbidDemo, validate({ body: emailBody.extend({ level }) }), asyncHandler(async (req, res) => created(res, await familyService.share(req.user!.id, req.body.email, req.body.level))));
familyRouter.post("/request", forbidDemo, validate({ body: emailBody }), asyncHandler(async (req, res) => created(res, await familyService.request(req.user!.id, req.body.email))));
familyRouter.put("/access/:id", forbidDemo, validate({ params: id, body: z.object({ level }) }), asyncHandler(async (req, res) => ok(res, await familyService.setLevel(req.user!.id, req.params.id, req.body.level))));
familyRouter.delete("/access/:id", validate({ params: id }), asyncHandler(async (req, res) => ok(res, await familyService.end(req.user!.id, req.params.id))));
