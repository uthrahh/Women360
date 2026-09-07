import { Router } from "express";
import { asyncHandler } from "@/lib/asyncHandler";
import { validate } from "@/middleware/validate";
import { requireAuth } from "@/middleware/auth";
import { authRateLimiter } from "@/middleware/rateLimit";
import { created, ok } from "@/lib/response";
import { authService } from "./auth.service";
import {
  loginSchema,
  refreshSchema,
  registerSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
} from "./auth.validation";

export const authRouter = Router();

authRouter.post(
  "/register",
  authRateLimiter,
  validate({ body: registerSchema }),
  asyncHandler(async (req, res) => {
    const result = await authService.register(req.body);
    return created(res, result);
  })
);

authRouter.post(
  "/login",
  authRateLimiter,
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    const result = await authService.login(req.body.email, req.body.password);
    return ok(res, result);
  })
);

authRouter.post(
  "/refresh",
  authRateLimiter,
  validate({ body: refreshSchema }),
  asyncHandler(async (req, res) => {
    const result = await authService.refresh(req.body.refreshToken);
    return ok(res, result);
  })
);

authRouter.post(
  "/logout",
  validate({ body: refreshSchema }),
  asyncHandler(async (req, res) => {
    await authService.logout(req.body.refreshToken);
    return ok(res, { loggedOut: true });
  })
);

authRouter.post(
  "/password-reset/request",
  authRateLimiter,
  validate({ body: requestPasswordResetSchema }),
  asyncHandler(async (req, res) => {
    await authService.requestPasswordReset(req.body.email);
    // Same response whether or not the account exists (see service layer).
    return ok(res, { requested: true });
  })
);

authRouter.post(
  "/password-reset/confirm",
  authRateLimiter,
  validate({ body: resetPasswordSchema }),
  asyncHandler(async (req, res) => {
    await authService.resetPassword(req.body.token, req.body.newPassword);
    return ok(res, { reset: true });
  })
);

authRouter.post(
  "/onboarding/complete",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await authService.completeOnboarding(req.user!.id);
    return ok(res, user);
  })
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await authService.me(req.user!.id);
    return ok(res, user);
  })
);
