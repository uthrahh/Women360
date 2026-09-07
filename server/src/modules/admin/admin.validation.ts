import { z } from "zod";

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  role: z.enum(["WOMAN", "COACH", "ADMIN"]).optional(),
  search: z.string().trim().max(200).optional(),
});

export const updateRoleSchema = z.object({
  role: z.enum(["WOMAN", "COACH", "ADMIN"]),
});

export const userIdParamSchema = z.object({ userId: z.string().min(1) });

export const listAuditLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  action: z.string().trim().max(100).optional(),
});
