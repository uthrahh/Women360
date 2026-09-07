import { Router } from "express";
import { asyncHandler } from "@/lib/asyncHandler";
import { validate } from "@/middleware/validate";
import { requireAuth } from "@/middleware/auth";
import { created, noContent, ok } from "@/lib/response";
import { healthService } from "./health.service";
import { appointmentSchema, idParamSchema, medicationSchema, vitalSchema } from "./health.validation";

export const healthRouter = Router();
healthRouter.use(requireAuth);

// Appointments
healthRouter.get(
  "/appointments",
  asyncHandler(async (req, res) => ok(res, await healthService.listAppointments(req.user!.id)))
);
healthRouter.post(
  "/appointments",
  validate({ body: appointmentSchema }),
  asyncHandler(async (req, res) => created(res, await healthService.createAppointment(req.user!.id, req.body)))
);
healthRouter.patch(
  "/appointments/:id",
  validate({ params: idParamSchema, body: appointmentSchema.partial() }),
  asyncHandler(async (req, res) =>
    ok(res, await healthService.updateAppointment(req.user!.id, req.params.id, req.body))
  )
);
healthRouter.delete(
  "/appointments/:id",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    await healthService.deleteAppointment(req.user!.id, req.params.id);
    return noContent(res);
  })
);

// Medications
healthRouter.get(
  "/medications",
  asyncHandler(async (req, res) => ok(res, await healthService.listMedications(req.user!.id)))
);
healthRouter.post(
  "/medications",
  validate({ body: medicationSchema }),
  asyncHandler(async (req, res) => created(res, await healthService.createMedication(req.user!.id, req.body)))
);
healthRouter.patch(
  "/medications/:id",
  validate({ params: idParamSchema, body: medicationSchema.partial() }),
  asyncHandler(async (req, res) =>
    ok(res, await healthService.updateMedication(req.user!.id, req.params.id, req.body))
  )
);
healthRouter.delete(
  "/medications/:id",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    await healthService.deleteMedication(req.user!.id, req.params.id);
    return noContent(res);
  })
);

// Vitals
healthRouter.get(
  "/vitals",
  asyncHandler(async (req, res) => ok(res, await healthService.listVitals(req.user!.id)))
);
healthRouter.post(
  "/vitals",
  validate({ body: vitalSchema }),
  asyncHandler(async (req, res) => created(res, await healthService.addVital(req.user!.id, req.body)))
);
