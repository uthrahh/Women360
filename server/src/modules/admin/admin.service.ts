import { prisma } from "@/lib/prisma";
import { BadRequestError, NotFoundError } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";
import type { Role } from "@prisma/client";

export const adminService = {
  async listUsers(query: { page: number; pageSize: number; role?: Role; search?: string }) {
    const where = {
      deletedAt: null,
      role: query.role,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" as const } },
              { email: { contains: query.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: { id: true, name: true, email: true, role: true, onboarded: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.user.count({ where }),
    ]);
    return { items, total };
  },

  async updateRole(actorId: string, targetUserId: string, role: Role) {
    if (actorId === targetUserId) {
      throw new BadRequestError("You can't change your own role.");
    }
    const target = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) throw new NotFoundError("User not found.");

    const updated = await prisma.user.update({ where: { id: targetUserId }, data: { role } });
    await recordAudit({
      actorId,
      actorRole: "ADMIN",
      action: "user.role_changed",
      targetType: "User",
      targetId: targetUserId,
      metadata: { fromRole: target.role, toRole: role },
    });
    return updated;
  },

  async deactivateUser(actorId: string, targetUserId: string) {
    if (actorId === targetUserId) {
      throw new BadRequestError("You can't deactivate your own account.");
    }
    const target = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) throw new NotFoundError("User not found.");

    await prisma.$transaction([
      prisma.user.update({ where: { id: targetUserId }, data: { deletedAt: new Date() } }),
      prisma.refreshToken.updateMany({
        where: { userId: targetUserId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    await recordAudit({
      actorId,
      actorRole: "ADMIN",
      action: "user.deactivated",
      targetType: "User",
      targetId: targetUserId,
    });
  },

  async listAuditLog(query: { page: number; pageSize: number; action?: string }) {
    const where = query.action ? { action: query.action } : {};
    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);
    return { items, total };
  },
};
