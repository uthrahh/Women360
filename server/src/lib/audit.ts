import { prisma } from "@/lib/prisma";
import type { Prisma, Role } from "@prisma/client";

/**
 * Records that something happened, never what it contained. `metadata`
 * must stay limited to ids, counts, and field names — never request
 * bodies or health-record values (see AuditLog model comment).
 */
export async function recordAudit(input: {
  actorId: string | null;
  actorRole: Role | null;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}) {
  await prisma.auditLog.create({
    data: {
      actorId: input.actorId,
      actorRole: input.actorRole,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    },
  });
}
