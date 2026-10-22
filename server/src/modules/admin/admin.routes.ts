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

adminRouter.get(
  "/feedback",
  validate({ query: listAuditLogQuerySchema }),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as { page: number; pageSize: number };
    const { items, total } = await feedbackService.list(query, req.user!.isDemo);
    return paginated(res, items, { page: query.page, pageSize: query.pageSize, total });
  })
);
