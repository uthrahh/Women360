import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "@/lib/asyncHandler";
import { validate } from "@/middleware/validate";
import { requireAuth } from "@/middleware/auth";
import { created } from "@/lib/response";
import { feedbackService } from "./feedback.service";

export const feedbackRouter = Router();
feedbackRouter.use(requireAuth);

const submitFeedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  message: z.string().trim().max(2000).optional(),
});

feedbackRouter.post(
  "/",
  validate({ body: submitFeedbackSchema }),
  asyncHandler(async (req, res) => created(res, await feedbackService.submit(req.user!.id, req.body)))
);
