import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";
import { hashPassword } from "@/lib/password";
import { ageOn } from "@/lib/age";
import { accessTo } from "./acting";

/** Family profiles are for people aged 13 and over; someone under 18 needs the manager to confirm they are their parent or guardian. */
export const FAMILY_MINIMUM_AGE = 13;
const ADULT = 18;
/** Profiles can't sign in: an address that can never receive mail (".invalid" is reserved) and a random password nobody knows. */
const PROFILE_DOMAIN = "profiles.women360.invalid";
export const isProfileAddress = (email: string) => email.endsWith("@" + PROFILE_DOMAIN);

const todayUtc = () => new Date().toISOString().slice(0, 10);
const initials = (name: string) => name.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

async function notify(userId: string, title: string, detail: string) {
  await prisma.notification.create({ data: { userId, title, detail } });
}

function checkBirthDate(dateOfBirth: string, guardianConfirmed: boolean | undefined, today = todayUtc()) {
  const d = new Date(`${dateOfBirth}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== dateOfBirth || dateOfBirth > today || ageOn(dateOfBirth, today) > 120) {
    throw new BadRequestError("Please enter a real date of birth.");
  }
  const age = ageOn(dateOfBirth, today);
  if (age < FAMILY_MINIMUM_AGE) throw new BadRequestError(`Family profiles are for people aged ${FAMILY_MINIMUM_AGE} and over.`);
  if (age < ADULT && !guardianConfirmed) throw new BadRequestError("For someone under 18, confirm that you are their parent or legal guardian.");
  return { date: d, minor: age < ADULT };
}

async function managedBy(managerId: string, profileId: string) {
  const p = await prisma.user.findFirst({ where: { id: profileId, managedById: managerId, deletedAt: null } });
  if (!p) throw new NotFoundError("We couldn't find that family profile.");
  return p;
}

/** Finds a person's own account by the address they sign in with. Family access is between people, never staff or demo accounts. */
async function personByEmail(email: string, selfId: string) {
  const u = await prisma.user.findFirst({ where: { email: email.trim().toLowerCase(), deletedAt: null } });
  if (!u || u.role !== "WOMAN" || u.isDemo || u.managedById || isProfileAddress(u.email)) {
    throw new BadRequestError("No Women360 account uses that address. They can sign up first, then you can link to each other.");
  }
  if (u.id === selfId) throw new BadRequestError("That's your own address.");
  return u;
}

export const familyService = {
  /** Everyone in her family view: profiles she keeps, people who share with her, people she shares with, and requests. */
  async overview(userId: string) {
    const [managed, received, given] = await Promise.all([
      prisma.user.findMany({
        where: { managedById: userId, deletedAt: null },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, relation: true, dateOfBirth: true, cycleTracking: true, avatarInitials: true },
      }),
      prisma.familyAccess.findMany({ where: { viewerId: userId }, include: { owner: { select: { id: true, name: true, email: true, cycleTracking: true, avatarInitials: true } } }, orderBy: { createdAt: "asc" } }),
      prisma.familyAccess.findMany({ where: { ownerId: userId }, include: { viewer: { select: { id: true, name: true, email: true, avatarInitials: true } } }, orderBy: { createdAt: "asc" } }),
    ]);
    return {
      managed: managed.map((m) => ({ ...m, dateOfBirth: m.dateOfBirth ? m.dateOfBirth.toISOString().slice(0, 10) : null })),
      sharedWithMe: received.filter((r) => r.status === "ACTIVE").map((r) => ({ accessId: r.id, level: r.level, person: r.owner })),
      myRequests: received.filter((r) => r.status === "REQUESTED").map((r) => ({ accessId: r.id, person: { name: r.owner.name, email: r.owner.email } })),
      sharingWith: given.filter((g) => g.status === "ACTIVE").map((g) => ({ accessId: g.id, level: g.level, person: g.viewer })),
      requestsToMe: given.filter((g) => g.status === "REQUESTED").map((g) => ({ accessId: g.id, person: { name: g.viewer.name, email: g.viewer.email } })),
    };
  },

  /** Opening someone's records: checks access, records that it happened, and says what the screens need to know. */
  async open(viewerId: string, subjectId: string) {
    const found = await accessTo(viewerId, subjectId);
    if (!found) throw new ForbiddenError("You don't have access to these records.");
    const s = await prisma.user.findUniqueOrThrow({ where: { id: subjectId }, select: { id: true, name: true, cycleTracking: true, dateOfBirth: true } });
    await recordAudit({ actorId: viewerId, actorRole: "WOMAN", action: "family.records_opened", targetType: "User", targetId: subjectId, metadata: { access: found.access } });
    return { id: s.id, name: s.name, access: found.access, cycleTracking: s.cycleTracking, minor: s.dateOfBirth ? ageOn(s.dateOfBirth.toISOString().slice(0, 10), todayUtc()) < ADULT : false };
  },

  async createProfile(managerId: string, input: { name: string; dateOfBirth: string; relation?: string | null; cycleTracking: boolean; guardianConfirmed?: boolean }) {
    const { date, minor } = checkBirthDate(input.dateOfBirth, input.guardianConfirmed);
    const count = await prisma.user.count({ where: { managedById: managerId, deletedAt: null } });
    if (count >= 10) throw new ConflictError("You can keep up to 10 family profiles.");
    const p = await prisma.user.create({
      data: {
        email: `${crypto.randomUUID()}@${PROFILE_DOMAIN}`,
        passwordHash: await hashPassword(crypto.randomBytes(32).toString("base64url")),
        name: input.name,
        dateOfBirth: date,
        relation: input.relation ?? null,
        cycleTracking: input.cycleTracking,
        avatarInitials: initials(input.name),
        onboarded: true,
        managedById: managerId,
        guardianConsentAt: minor ? new Date() : null,
      },
      select: { id: true, name: true },
    });
    await recordAudit({ actorId: managerId, actorRole: "WOMAN", action: "family.profile_created", targetType: "User", targetId: p.id, metadata: { minor } });
    return p;
  },

  async updateProfile(managerId: string, id: string, input: { name?: string; dateOfBirth?: string; relation?: string | null; cycleTracking?: boolean; guardianConfirmed?: boolean }) {
    const p = await managedBy(managerId, id);
    const data: Record<string, unknown> = {};
    if (input.name !== undefined) Object.assign(data, { name: input.name, avatarInitials: initials(input.name) });
    if (input.relation !== undefined) data.relation = input.relation;
    if (input.cycleTracking !== undefined) data.cycleTracking = input.cycleTracking;
    if (input.dateOfBirth !== undefined) {
      const { date, minor } = checkBirthDate(input.dateOfBirth, input.guardianConfirmed ?? Boolean(p.guardianConsentAt));
      Object.assign(data, { dateOfBirth: date, guardianConsentAt: minor ? p.guardianConsentAt ?? new Date() : null });
    }
    await prisma.user.update({ where: { id }, data });
    return { ok: true };
  },

  /** Deletes a family profile and everything recorded in it. */
  async deleteProfile(managerId: string, id: string) {
    await managedBy(managerId, id);
    await prisma.user.delete({ where: { id } });
    await recordAudit({ actorId: managerId, actorRole: "WOMAN", action: "family.profile_deleted", targetType: "User" });
  },

  /** She lets someone in her family see (MONITOR) or also change (MODIFY) her records. */
  async share(ownerId: string, email: string, level: "MONITOR" | "MODIFY") {
    const viewer = await personByEmail(email, ownerId);
    const row = await prisma.familyAccess.upsert({
      where: { ownerId_viewerId: { ownerId, viewerId: viewer.id } },
      create: { ownerId, viewerId: viewer.id, status: "ACTIVE", level },
      update: { status: "ACTIVE", level },
    });
    const owner = await prisma.user.findUniqueOrThrow({ where: { id: ownerId }, select: { name: true } });
    await recordAudit({ actorId: ownerId, actorRole: "WOMAN", action: "family.access_given", targetType: "FamilyAccess", targetId: row.id, metadata: { level } });
    await notify(viewer.id, "Family access", `${owner.name} shared ${level === "MODIFY" ? "and lets you update" : "(to view)"} her records with you. Open Family to see them.`);
    return { accessId: row.id };
  },

  /** She asks a family member for access to theirs; they choose the level, or decline. */
  async request(viewerId: string, email: string) {
    const owner = await personByEmail(email, viewerId);
    const existing = await prisma.familyAccess.findUnique({ where: { ownerId_viewerId: { ownerId: owner.id, viewerId } } });
    if (existing?.status === "ACTIVE") throw new ConflictError("They already share their records with you.");
    const row = existing ?? (await prisma.familyAccess.create({ data: { ownerId: owner.id, viewerId, status: "REQUESTED" } }));
    const viewer = await prisma.user.findUniqueOrThrow({ where: { id: viewerId }, select: { name: true } });
    if (!existing) await notify(owner.id, "A family member asked to see your records", `${viewer.name} asked. Open Family to choose what to share, or decline.`);
    return { accessId: row.id };
  },

  /** Only the owner sets the level: approving a request, or changing it later. */
  async setLevel(ownerId: string, accessId: string, level: "MONITOR" | "MODIFY") {
    const row = await prisma.familyAccess.findUnique({ where: { id: accessId } });
    if (!row || row.ownerId !== ownerId) throw new NotFoundError();
    await prisma.familyAccess.update({ where: { id: accessId }, data: { status: "ACTIVE", level } });
    await recordAudit({ actorId: ownerId, actorRole: "WOMAN", action: "family.access_given", targetType: "FamilyAccess", targetId: accessId, metadata: { level } });
    const owner = await prisma.user.findUniqueOrThrow({ where: { id: ownerId }, select: { name: true } });
    await notify(row.viewerId, "Family access", `${owner.name} ${row.status === "REQUESTED" ? "accepted your request" : "changed your access"}: you can ${level === "MODIFY" ? "see and update" : "see"} her records.`);
    return { ok: true };
  },

  /** Ends access, from either side: the owner revokes or declines, the viewer stops looking or withdraws a request. */
  async end(userId: string, accessId: string) {
    const row = await prisma.familyAccess.findUnique({ where: { id: accessId } });
    if (!row || (row.ownerId !== userId && row.viewerId !== userId)) throw new NotFoundError();
    await prisma.familyAccess.delete({ where: { id: accessId } });
    await recordAudit({ actorId: userId, actorRole: "WOMAN", action: "family.access_ended", targetType: "FamilyAccess", metadata: { by: row.ownerId === userId ? "owner" : "viewer" } });
    return { ok: true };
  },
};
