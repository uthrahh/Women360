import { Router } from "express";
import { asyncHandler } from "@/lib/asyncHandler";
import { validate } from "@/middleware/validate";
import { requireAuth } from "@/middleware/auth";
import { requireRole } from "@/middleware/rbac";
import { requireAdminIp, requireAdminTwoFactor } from "@/middleware/adminGuards";
import { blockDemoWrites } from "@/middleware/demoGuard";
import { noContent, ok, paginated } from "@/lib/response";
import { adminService } from "./admin.service";
import { feedbackService } from "@/modules/feedback/feedback.service";
import { summary as usageSummary } from "@/modules/usage/usage.service";
import { systemStatus } from "@/modules/system/system.service";
import { z } from "zod";
import { ForbiddenError } from "@/lib/errors";
import {
  listAuditLogQuerySchema,
  listUsersQuerySchema,
  updateRoleSchema,
  userIdParamSchema,
} from "./admin.validation";

export const adminRouter = Router();
// Order matters: the IP check is first so outsiders learn nothing, and the
// two-factor check is last so it only ever runs for a real, authenticated admin.
adminRouter.use(requireAdminIp, requireAuth, requireRole("ADMIN"), asyncHandler(requireAdminTwoFactor), blockDemoWrites);

adminRouter.get(
  "/overview",
  asyncHandler(async (req, res) => ok(res, await adminService.overview(req.user!.isDemo)))
);

adminRouter.get(
  "/users",
  validate({ query: listUsersQuerySchema }),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as {
      page: number; pageSize: number; role?: "WOMAN" | "COACH" | "ADMIN"; search?: string;
    };
    const { items, total } = await adminService.listUsers(query, req.user!.isDemo);
    return paginated(res, items, { page: query.page, pageSize: query.pageSize, total });
  })
);

adminRouter.patch(
  "/users/:userId/role",
  validate({ params: userIdParamSchema, body: updateRoleSchema }),
  asyncHandler(async (req, res) =>
    ok(res, await adminService.updateRole(req.user!.id, req.params.userId, req.body.role))
  )
);

adminRouter.delete(
  "/users/:userId",
  validate({ params: userIdParamSchema }),
  asyncHandler(async (req, res) => {
    await adminService.deactivateUser(req.user!.id, req.params.userId);
    return noContent(res);
  })
);

adminRouter.get(
  "/audit-log",
  validate({ query: listAuditLogQuerySchema }),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as { page: number; pageSize: number; action?: string };
    const { items, total } = await adminService.listAuditLog(query, req.user!.isDemo);
    return paginated(res, items, { page: query.page, pageSize: query.pageSize, total });
  })
);

// How the running service is doing: database, email, reminders, backup proof. Read-only; booleans and times, no secrets.
adminRouter.get(
  "/system",
  asyncHandler(async (_req, res) => ok(res, await systemStatus()))
);

// Anonymous usage counts (what is used, never who). Read-only, so the demonstration administrator may see it too.
adminRouter.get(
  "/usage",
  validate({ query: z.object({ days: z.coerce.number().int().min(1).max(365).default(30) }) }),
  asyncHandler(async (req, res) => {
    // The shared demonstration administrator never sees real people's activity, even anonymous totals of it.
    if (req.user!.isDemo) throw new ForbiddenError("Usage figures aren't shown on the shared demonstration account.");
    return ok(res, await usageSummary((req.query as unknown as { days: number }).days));
  })
);

adminRouter.get(
  "/feedback",
  validate({ query: listAuditLogQuerySchema }),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as { page: number; pageSize: number };
    const { items, total } = await feedbackService.list(query, req.user!.isDemo);
    return paginated(res, items, { page: query.page, pageSize: query.pageSize, total });
  })
);
