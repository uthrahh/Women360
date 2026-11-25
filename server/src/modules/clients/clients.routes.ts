import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "@/lib/asyncHandler";
import { validate } from "@/middleware/validate";
import { requireAuth } from "@/middleware/auth";
import { requireRole } from "@/middleware/rbac";
import { authRateLimiter } from "@/middleware/rateLimit";
import { created, noContent, ok } from "@/lib/response";
import { isValidIsoDay } from "@/lib/streak";
import { adminCoachesService, clientsService, inviteService, myCoachingService } from "./clients.service";
import { INTAKE_SECTIONS } from "./intake";

const isoDay = z.string().refine(isValidIsoDay, "Use a date in YYYY-MM-DD format.");
const id = z.object({ id: z.string().min(1).max(60) });
const SPEC = z.enum(["GENERAL", "NUTRITION", "FITNESS", "WELLBEING", "WOMENS_HEALTH"]);
const text = (max: number) => z.string().trim().max(max).nullable().optional().transform((v) => (v === undefined ? undefined : v || null));
const measure = (max: number) => z.number().positive().max(max).nullable().optional();

const basicFields = {
  name: z.string().trim().min(1).max(80),
  dateOfBirth: isoDay,
  gender: z.enum(["Woman", "Man", "Non-binary", "Prefer not to say"]).nullable().optional(),
  email: z.string().trim().email().max(200).nullable().optional().or(z.literal("").transform(() => null)),
  phone: text(30),
  address: text(300),
  occupation: text(80),
  maritalStatus: z.enum(["Single", "Married", "Divorced", "Widowed", "Prefer not to say"]).nullable().optional(),
  tracksCycle: z.boolean(),
  guardianConsent: z.boolean().optional(),
};
const newClient = z.object({ ...basicFields, consent: z.literal(true, { error: "Confirm that the client agreed to her details being recorded." }) });
const basicUpdate = z.object(Object.fromEntries(Object.entries(basicFields).map(([k, v]) => [k, (v as z.ZodTypeAny).optional()])));
const measurement = z.object({
  date: isoDay,
  heightCm: measure(260), weightKg: measure(400), waistCm: measure(300), hipCm: measure(300), chestCm: measure(300), armCm: measure(120), thighCm: measure(200),
});
const consultation = z.object({
  area: SPEC,
  date: isoDay,
  targetWeightKg: measure(400),
  targetDate: isoDay.nullable().optional(),
  planGiven: text(4000),
  nextFollowUp: isoDay.nullable().optional(),
  notes: text(4000),
});

/** Coaches: /coach/clients. Every route checks that the coach is one of this client's coaches, and cuts the record to her specialities. */
export const coachClientsRouter = Router();
coachClientsRouter.use(requireAuth, requireRole("COACH"));

coachClientsRouter.get("/form", (_req, res) => ok(res, { ...clientsService.form(), specialities: clientsService.specialities() }));
coachClientsRouter.get("/directory", asyncHandler(async (req, res) => ok(res, await clientsService.directory(req.user!.isDemo))));
coachClientsRouter.get("/", asyncHandler(async (req, res) => ok(res, await clientsService.list(req.user!.id))));
coachClientsRouter.post("/", validate({ body: newClient }), asyncHandler(async (req, res) => created(res, await clientsService.create(req.user!.id, req.user!.isDemo, req.body))));
coachClientsRouter.get("/:id", validate({ params: id }), asyncHandler(async (req, res) => ok(res, await clientsService.record(req.user!.id, req.params.id))));
coachClientsRouter.get("/:id/logs", validate({ params: id, query: z.object({ today: isoDay }) }), asyncHandler(async (req, res) => ok(res, await clientsService.logs(req.user!.id, req.params.id, (req.query as { today: string }).today))));
coachClientsRouter.patch("/:id", validate({ params: id, body: basicUpdate }), asyncHandler(async (req, res) => ok(res, await clientsService.updateBasic(req.user!.id, req.params.id, req.body))));
coachClientsRouter.delete(
  "/:id",
  validate({ params: id }),
  asyncHandler(async (req, res) => {
    await clientsService.remove(req.user!.id, req.params.id);
    return noContent(res);
  })
);
coachClientsRouter.put(
  "/:id/intake/:section",
  validate({ params: id.extend({ section: z.enum(INTAKE_SECTIONS as [string, ...string[]]) }), body: z.object({ answers: z.record(z.string().max(40), z.unknown()) }) }),
  asyncHandler(async (req, res) => ok(res, await clientsService.saveSection(req.user!.id, req.params.id, req.params.section as never, req.body.answers)))
);
coachClientsRouter.post("/:id/measurements", validate({ params: id, body: measurement }), asyncHandler(async (req, res) => created(res, await clientsService.addMeasurement(req.user!.id, req.params.id, req.body))));
coachClientsRouter.delete(
  "/:id/measurements/:mid",
  validate({ params: id.extend({ mid: z.string().min(1).max(60) }) }),
  asyncHandler(async (req, res) => {
    await clientsService.deleteMeasurement(req.user!.id, req.params.id, req.params.mid);
    return noContent(res);
  })
);
coachClientsRouter.post("/:id/consultations", validate({ params: id, body: consultation }), asyncHandler(async (req, res) => created(res, await clientsService.addConsultation(req.user!.id, req.params.id, req.body))));
coachClientsRouter.patch("/consultations/:id", validate({ params: id, body: consultation.omit({ area: true }).partial() }), asyncHandler(async (req, res) => ok(res, await clientsService.updateConsultation(req.user!.id, req.params.id, req.body))));
coachClientsRouter.delete("/consultations/:id", validate({ params: id }), asyncHandler(async (req, res) => ok(res, await clientsService.updateConsultation(req.user!.id, req.params.id, null))));
coachClientsRouter.post("/:id/coaches", validate({ params: id, body: z.object({ coachId: z.string().min(1).max(60) }) }), asyncHandler(async (req, res) => ok(res, await clientsService.addCoach(req.user!.id, req.params.id, req.body.coachId))));
coachClientsRouter.post("/:id/leave", validate({ params: id }), asyncHandler(async (req, res) => ok(res, await clientsService.leave(req.user!.id, req.params.id))));
coachClientsRouter.post("/:id/invite", validate({ params: id }), asyncHandler(async (req, res) => ok(res, await clientsService.invite(req.user!.id, req.params.id))));

/** The one-time link to claim a record (public, rate limited like sign-in). */
export const inviteRouter = Router();
inviteRouter.use(authRateLimiter);
inviteRouter.get("/:token", validate({ params: z.object({ token: z.string().min(20).max(100) }) }), asyncHandler(async (req, res) => ok(res, await inviteService.peek(req.params.token))));
inviteRouter.post(
  "/:token",
  validate({
    params: z.object({ token: z.string().min(20).max(100) }),
    body: z.object({ password: z.string().min(1).max(200), email: z.string().trim().email().max(200).nullable().optional(), agreed: z.literal(true) }),
  }),
  asyncHandler(async (req, res) => ok(res, await inviteService.claim(req.params.token, req.body)))
);

/** The client: /coaching. Her coaches and what they recorded. */
export const myCoachingRouter = Router();
myCoachingRouter.use(requireAuth, requireRole("WOMAN"));
myCoachingRouter.get("/", asyncHandler(async (req, res) => ok(res, await myCoachingService.overview(req.user!.id))));
myCoachingRouter.delete("/coaches/:id", validate({ params: id }), asyncHandler(async (req, res) => ok(res, await myCoachingService.removeCoach(req.user!.id, req.params.id))));

/** Administrators: mounted at /admin/coaches, behind the admin guards. */
export const adminCoachesRouter = Router();
adminCoachesRouter.get("/", asyncHandler(async (req, res) => ok(res, await adminCoachesService.coaches(req.user!.isDemo))));
adminCoachesRouter.post(
  "/",
  validate({ body: z.object({ name: z.string().trim().min(1).max(80), email: z.string().trim().email().max(200), specialities: z.array(SPEC).max(5) }) }),
  asyncHandler(async (req, res) => created(res, await adminCoachesService.createCoach(req.user!.id, req.body)))
);
adminCoachesRouter.put("/:id/specialities", validate({ params: id, body: z.object({ specialities: z.array(SPEC).max(5) }) }), asyncHandler(async (req, res) => ok(res, await adminCoachesService.setSpecialities(req.user!.id, req.params.id, req.body.specialities))));
adminCoachesRouter.post("/:id/link", validate({ params: id }), asyncHandler(async (req, res) => ok(res, await adminCoachesService.newCoachLink(req.user!.id, req.params.id))));
