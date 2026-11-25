import type { AuthenticatedUser } from "@/middleware/auth";
import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";

/**
 * The records a family member can be given access to: her tracking (cycle, food and water, body log, activity and steps,
 * sleep, wellbeing, habits, goals, medicines, appointments and measurements) and what is worked out from it (insights,
 * reports, check-ups), plus her name and age so the screens can say whose records they are. Never her account, password,
 * sign-in or data download, her reproductive record (contraception, pregnancy), her health profile, her sharing with a
 * coach or other family, her programme, her AI chat, messages or notifications.
 */
const OPEN = /^\/api\/v1\/(cycle|nutrition|body|activity|sleep|wellbeing|goals|habits|health|insights|reports|conditions|screening|game)(\/|$)/;
const READ_ONLY = /^\/api\/v1\/auth\/me$/;

export type Access = "MANAGE" | "MODIFY" | "MONITOR";
const WRITES = (method: string) => !["GET", "HEAD", "OPTIONS"].includes(method);

/** Whether `viewerId` may look at (or change) `subjectId`'s records, and how. Null when not at all. */
export async function accessTo(viewerId: string, subjectId: string): Promise<{ access: Access; name: string } | null> {
  const subject = await prisma.user.findFirst({ where: { id: subjectId, deletedAt: null, role: "WOMAN" }, select: { id: true, name: true, managedById: true } });
  if (!subject) return null;
  if (subject.managedById === viewerId) return { access: "MANAGE", name: subject.name };
  const grant = await prisma.familyAccess.findUnique({ where: { ownerId_viewerId: { ownerId: subjectId, viewerId } } });
  if (grant?.status === "ACTIVE" && grant.level) return { access: grant.level, name: subject.name };
  return null;
}

/**
 * Turns a request made "for" a family member into a request about her records, after checking every rule: the asker is a
 * person (not staff, not a demonstration account), the screen is one family access covers, she has access, and a view-only
 * access never writes. A change is recorded in the audit log (the route's shape only, never what was written).
 */
export async function resolveActing(user: AuthenticatedUser, subjectId: string, method: string, url: string): Promise<AuthenticatedUser> {
  const path = url.split("?")[0];
  if (user.role !== "WOMAN" || user.isDemo) throw new ForbiddenError("Family access isn't available on this account.");
  const allowed = OPEN.test(path) || (READ_ONLY.test(path) && !WRITES(method));
  if (!allowed) throw new ForbiddenError("This isn't available while you're looking at a family member's records.");
  const found = await accessTo(user.id, subjectId);
  if (!found) {
    await recordAudit({ actorId: user.id, actorRole: user.role, action: "security.family_access_denied", targetType: "User", targetId: subjectId });
    throw new ForbiddenError("You don't have access to these records.");
  }
  if (found.access === "MONITOR" && WRITES(method)) {
    throw new ForbiddenError(`${found.name.split(" ")[0]} gave you view-only access, so you can look but not change anything.`);
  }
  if (WRITES(method)) {
    await recordAudit({
      actorId: user.id,
      actorRole: user.role,
      action: "family.record_changed",
      targetType: "User",
      targetId: subjectId,
      metadata: { method, route: path.replace(/\/api\/v1/, "").replace(/\/[a-z0-9]{20,}/gi, "/:id") },
    });
  }
  return { id: subjectId, role: "WOMAN", isDemo: false, actorId: user.id, access: found.access };
}
