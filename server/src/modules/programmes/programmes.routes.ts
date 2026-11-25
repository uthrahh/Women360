import { Router } from "express";
import { asyncHandler } from "@/lib/asyncHandler";
import { validate } from "@/middleware/validate";
import { requireAuth } from "@/middleware/auth";
import { requireRole } from "@/middleware/rbac";
import { created, noContent, ok } from "@/lib/response";
import { adminProgrammeService, coachProgrammeService, programmesService } from "./programmes.service";
import {
  addTaskBody,
  approveBody,
  assessmentBody,
  assignCoachBody,
  changeTaskBody,
  idParam,
  kindQuery,
  programmeBody,
  programmeUpdateBody,
  publishBody,
  replyBody,
  reviewBody,
  taskLogBody,
  taskStateBody,
  templateBody,
  templateUpdateBody,
  todayQuery,
} from "./programmes.validation";

const today = (req: { query: unknown }) => (req.query as { today: string }).today;

/** The woman's side: /programmes. Her own enrolment only; her calendar date comes from her device. */
export const programmesRouter = Router();
// The question wording is the same for everyone signed in (her coach reads her answers against it).
programmesRouter.get("/questions", requireAuth, validate({ query: kindQuery }), (req, res) => ok(res, programmesService.questions((req.query as { kind: "BASELINE" | "FINAL" }).kind)));

programmesRouter.use(requireAuth, requireRole("WOMAN"));

programmesRouter.get(
  "/me",
  validate({ query: todayQuery }),
  asyncHandler(async (req, res) => ok(res, await programmesService.mine(req.user!.id, req.user!.isDemo, today(req))))
);

programmesRouter.post(
  "/:id/join",
  validate({ params: idParam }),
  asyncHandler(async (req, res) => created(res, await programmesService.join(req.user!.id, req.user!.isDemo, req.params.id)))
);

programmesRouter.put(
  "/me/assessment",
  validate({ body: assessmentBody }),
  asyncHandler(async (req, res) => ok(res, await programmesService.saveAssessment(req.user!.id, req.body.kind, req.body.answers, req.body.submit)))
);

programmesRouter.post(
  "/me/tasks/:id/events",
  validate({ params: idParam, body: taskLogBody, query: todayQuery }),
  asyncHandler(async (req, res) => ok(res, await programmesService.logTask(req.user!.id, req.params.id, req.body, today(req))))
);

programmesRouter.post("/me/leave", asyncHandler(async (req, res) => ok(res, await programmesService.leave(req.user!.id))));

/** The coach's side: mounted at /coach/programme. Only enrolments an administrator assigned to this coach. */
export const coachProgrammeRouter = Router();
coachProgrammeRouter.use(requireAuth, requireRole("COACH"));

coachProgrammeRouter.get(
  "/caseload",
  validate({ query: todayQuery }),
  asyncHandler(async (req, res) => ok(res, await coachProgrammeService.caseload(req.user!.id, today(req))))
);

coachProgrammeRouter.get(
  "/enrolments/:id",
  validate({ params: idParam, query: todayQuery }),
  asyncHandler(async (req, res) => ok(res, await coachProgrammeService.detail(req.user!.id, req.params.id, today(req))))
);

coachProgrammeRouter.get(
  "/enrolments/:id/templates",
  validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await coachProgrammeService.templatesFor(req.user!.id, req.params.id)))
);

coachProgrammeRouter.post(
  "/enrolments/:id/tasks",
  validate({ params: idParam, body: addTaskBody }),
  asyncHandler(async (req, res) => created(res, await coachProgrammeService.addTask(req.user!.id, req.params.id, req.body)))
);

coachProgrammeRouter.post(
  "/enrolments/:id/publish",
  validate({ params: idParam, body: publishBody }),
  asyncHandler(async (req, res) => ok(res, await coachProgrammeService.publish(req.user!.id, req.params.id, req.body.reason)))
);

coachProgrammeRouter.post(
  "/enrolments/:id/reviews",
  validate({ params: idParam, body: reviewBody }),
  asyncHandler(async (req, res) => created(res, await coachProgrammeService.review(req.user!.id, req.params.id, req.body)))
);

coachProgrammeRouter.patch(
  "/tasks/:id",
  validate({ params: idParam, body: changeTaskBody, query: todayQuery }),
  asyncHandler(async (req, res) => ok(res, await coachProgrammeService.changeTask(req.user!.id, req.params.id, req.body, today(req))))
);

coachProgrammeRouter.delete(
  "/tasks/:id",
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    await coachProgrammeService.deleteDraft(req.user!.id, req.params.id);
    return noContent(res);
  })
);

coachProgrammeRouter.post(
  "/tasks/:id/state",
  validate({ params: idParam, body: taskStateBody, query: todayQuery }),
  asyncHandler(async (req, res) => ok(res, await coachProgrammeService.setTaskState(req.user!.id, req.params.id, req.body.action, req.body.reason, today(req))))
);

coachProgrammeRouter.post(
  "/tasks/:id/reply",
  validate({ params: idParam, body: replyBody }),
  asyncHandler(async (req, res) => ok(res, await coachProgrammeService.reply(req.user!.id, req.params.id, req.body.date, req.body.note)))
);

/** The administrator's side: mounted at /admin/programme, behind the admin guards (IP, two-factor, demo read-only). */
export const adminProgrammeRouter = Router();

adminProgrammeRouter.get("/programmes", asyncHandler(async (req, res) => ok(res, await adminProgrammeService.programmes(req.user!.isDemo))));
adminProgrammeRouter.post(
  "/programmes",
  validate({ body: programmeBody }),
  asyncHandler(async (req, res) => created(res, await adminProgrammeService.createProgramme(req.user!.id, req.body)))
);
adminProgrammeRouter.patch(
  "/programmes/:id",
  validate({ params: idParam, body: programmeUpdateBody }),
  asyncHandler(async (req, res) => ok(res, await adminProgrammeService.updateProgramme(req.user!.id, req.params.id, req.body)))
);

adminProgrammeRouter.get("/templates", asyncHandler(async (req, res) => ok(res, await adminProgrammeService.templates(req.user!.isDemo))));
adminProgrammeRouter.post(
  "/templates",
  validate({ body: templateBody }),
  asyncHandler(async (req, res) => created(res, await adminProgrammeService.createTemplate(req.user!.id, req.body)))
);
adminProgrammeRouter.patch(
  "/templates/:id",
  validate({ params: idParam, body: templateUpdateBody }),
  asyncHandler(async (req, res) => ok(res, await adminProgrammeService.updateTemplate(req.user!.id, req.params.id, req.body)))
);
adminProgrammeRouter.post(
  "/templates/:id/approve",
  validate({ params: idParam, body: approveBody }),
  asyncHandler(async (req, res) => ok(res, await adminProgrammeService.approveTemplate(req.user!.id, req.params.id, req.body.reviewedBy)))
);

adminProgrammeRouter.get("/enrolments", asyncHandler(async (req, res) => ok(res, await adminProgrammeService.enrolments(req.user!.isDemo))));
adminProgrammeRouter.get("/coaches", asyncHandler(async (req, res) => ok(res, await adminProgrammeService.coaches(req.user!.isDemo))));
adminProgrammeRouter.put(
  "/enrolments/:id/coach",
  validate({ params: idParam, body: assignCoachBody }),
  asyncHandler(async (req, res) => ok(res, await adminProgrammeService.assignCoach(req.user!.id, req.user!.role, req.params.id, req.body.coachId)))
);
