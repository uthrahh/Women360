import { Router } from "express";
import { asyncHandler } from "@/lib/asyncHandler";
import { validate } from "@/middleware/validate";
import { requireAuth } from "@/middleware/auth";
import { requireRole } from "@/middleware/rbac";
import { created, ok } from "@/lib/response";
import { coachService } from "./coach.service";
import {
  createNoteSchema,
  grantAccessSchema,
  revokeAccessSchema,
  womanIdParamSchema,
} from "./coach.validation";

export const coachRouter = Router();
coachRouter.use(requireAuth);

// Woman-side: manage who can see her data.
coachRouter.post(
  "/sharing",
  requireRole("WOMAN"),
  validate({ body: grantAccessSchema }),
  asyncHandler(async (req, res) => created(res, await coachService.grantAccess(req.user!.id, req.body.coachEmail)))
);

coachRouter.delete(
  "/sharing",
  requireRole("WOMAN"),
  validate({ body: revokeAccessSchema }),
  asyncHandler(async (req, res) => {
    await coachService.revokeAccess(req.user!.id, req.body.coachId);
    return ok(res, { revoked: true });
  })
);

coachRouter.get(
  "/sharing",
  requireRole("WOMAN"),
  asyncHandler(async (req, res) => ok(res, await coachService.listMySharing(req.user!.id)))
);

coachRouter.get(
  "/sharing/notes",
  requireRole("WOMAN"),
  asyncHandler(async (req, res) => ok(res, await coachService.listNotesForWoman(req.user!.id)))
);

// Coach-side: view assigned women and record notes.
coachRouter.get(
  "/assigned-women",
  requireRole("COACH"),
  asyncHandler(async (req, res) => ok(res, await coachService.listAssignedWomen(req.user!.id)))
);

coachRouter.get(
  "/women/:womanId/summary",
  requireRole("COACH"),
  validate({ params: womanIdParamSchema }),
  asyncHandler(async (req, res) =>
    ok(res, await coachService.getWomanSummary(req.user!.id, req.params.womanId))
  )
);

coachRouter.get(
  "/women/:womanId/notes",
  requireRole("COACH"),
  validate({ params: womanIdParamSchema }),
  asyncHandler(async (req, res) => ok(res, await coachService.listNotes(req.user!.id, req.params.womanId)))
);

coachRouter.post(
  "/women/:womanId/notes",
  requireRole("COACH"),
  validate({ params: womanIdParamSchema, body: createNoteSchema }),
  asyncHandler(async (req, res) =>
    created(res, await coachService.addNote(req.user!.id, req.params.womanId, req.body))
  )
);
