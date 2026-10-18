import { Router } from "express";
import { asyncHandler } from "@/lib/asyncHandler";
import { validate } from "@/middleware/validate";
import { requireAuth } from "@/middleware/auth";
import { authRateLimiter } from "@/middleware/rateLimit";
import { created, ok } from "@/lib/response";
import { authService } from "./auth.service";
import { twoFactorService } from "./twoFactor.service";
import {
  changePasswordSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
  twoFactorConfirmSchema,
  twoFactorLoginSchema,
  twoFactorReauthSchema,
} from "./auth.validation";

export const authRouter = Router();

authRouter.post(
  "/register",
  authRateLimiter,
  validate({ body: registerSchema }),
  asyncHandler(async (req, res) => {
    const result = await authService.register(req.body, req.ip);
    return created(res, result);
  })
);

authRouter.post(
  "/login",
  authRateLimiter,
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    const result = await authService.login(req.body.email, req.body.password, req.ip);
    return ok(res, result);
  })
);

// Step two of signing in when two-factor is on.
authRouter.post(
  "/login/2fa",
  authRateLimiter,
  validate({ body: twoFactorLoginSchema }),
  asyncHandler(async (req, res) => {
    const result = await twoFactorService.completeLogin(req.body.challengeToken, req.body.code, req.ip ?? "unknown");
    return ok(res, result);
  })
);

authRouter.get(
  "/2fa",
  requireAuth,
  asyncHandler(async (req, res) => ok(res, await twoFactorService.status(req.user!.id)))
);

authRouter.post(
  "/2fa/setup",
  requireAuth,
  authRateLimiter,
  asyncHandler(async (req, res) => ok(res, await twoFactorService.beginSetup(req.user!.id)))
);

authRouter.post(
  "/2fa/confirm",
  requireAuth,
  authRateLimiter,
  validate({ body: twoFactorConfirmSchema }),
  asyncHandler(async (req, res) =>
    ok(res, await twoFactorService.confirmSetup(req.user!.id, req.body.code, req.ip ?? "unknown"))
  )
);

authRouter.post(
  "/2fa/disable",
  requireAuth,
  authRateLimiter,
  validate({ body: twoFactorReauthSchema }),
  asyncHandler(async (req, res) =>
    ok(res, await twoFactorService.disable(req.user!.id, req.body.password, req.body.code, req.ip ?? "unknown"))
  )
);

authRouter.post(
  "/2fa/backup-codes",
  requireAuth,
  authRateLimiter,
  validate({ body: twoFactorReauthSchema }),
  asyncHandler(async (req, res) =>
    ok(res, await twoFactorService.regenerateBackupCodes(req.user!.id, req.body.password, req.body.code, req.ip ?? "unknown"))
  )
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
    await authService.resetPassword(req.body.token, req.body.newPassword, req.ip);
    return ok(res, { reset: true });
  })
);

authRouter.post(
  "/change-password",
  requireAuth,
  authRateLimiter,
  validate({ body: changePasswordSchema }),
  asyncHandler(async (req, res) => {
    const result = await authService.changePassword(req.user!.id, req.body.currentPassword, req.body.newPassword, req.ip);
    return ok(res, result);
  })
);

authRouter.post(
  "/logout-all",
  requireAuth,
  asyncHandler(async (req, res) => {
    await authService.logoutEverywhere(req.user!.id, req.ip);
    return ok(res, { loggedOut: true });
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
