import crypto from "node:crypto";
import type { CoachSpeciality, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { env } from "@/config/env";
import { hashToken } from "@/lib/jwt";
import { hashPassword } from "@/lib/password";
import { assertPasswordAcceptable } from "@/lib/passwordPolicy";
import { ageOn } from "@/lib/age";
import { recordAudit } from "@/lib/audit";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { issueSession } from "@/modules/auth/session";
import { publicUser } from "@/lib/publicUser";
import { SPECIALITIES, canSee, canSeeConsultation, effective, visibleLogs, visibleSections, type Section, type Speciality } from "./access";
import { INTAKE, INTAKE_VERSION, bmi, checkSection, waistHip, type IntakeSection } from "./intake";

const MIN_AGE = 13;
const ADULT = 18;
const INVITE_DAYS = 7;
/** A record with no address yet: it can't receive mail and nobody can sign in to it until it is claimed. */
const PLACEHOLDER_DOMAIN = "clients.women360.invalid";
const isPlaceholder = (email: string) => email.endsWith("@" + PLACEHOLDER_DOMAIN);

const todayUtc = () => new Date().toISOString().slice(0, 10);
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const asDate = (s: string) => new Date(s + "T00:00:00Z");
const initials = (name: string) => name.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

function checkBirth(dateOfBirth: string, guardianConsent: boolean) {
  const d = asDate(dateOfBirth);
  if (Number.isNaN(d.getTime()) || iso(d) !== dateOfBirth || dateOfBirth > todayUtc() || ageOn(dateOfBirth, todayUtc()) > 120) throw new BadRequestError("Please enter a real date of birth.");
  const age = ageOn(dateOfBirth, todayUtc());
  if (age < MIN_AGE) throw new BadRequestError(`Clients are recorded from age ${MIN_AGE}.`);
  if (age < ADULT && !guardianConsent) throw new BadRequestError("For someone under 18, confirm that a parent or guardian agreed.");
  return d;
}

async function coachSpecs(coachId: string): Promise<Speciality[]> {
  const c = await prisma.user.findUniqueOrThrow({ where: { id: coachId }, select: { coachSpecialities: true } });
  return effective(c.coachSpecialities as Speciality[]);
}

/** A coach reaches a client only through a ClientCoach row; anything else is refused and recorded. */
async function assertCoachOf(coachId: string, clientId: string) {
  const link = await prisma.clientCoach.findUnique({ where: { clientId_coachId: { clientId, coachId } } });
  if (!link) {
    await recordAudit({ actorId: coachId, actorRole: "COACH", action: "security.client_access_denied", targetType: "User", targetId: clientId });
    throw new ForbiddenError("You aren't one of this person's coaches.");
  }
}

function measurementView(m: { id: string; date: Date; heightCm: number | null; weightKg: number | null; waistCm: number | null; hipCm: number | null; chestCm: number | null; armCm: number | null; thighCm: number | null }) {
  return { ...m, date: iso(m.date), bmi: bmi(m.weightKg, m.heightCm), waistHipRatio: waistHip(m.waistCm, m.hipCm) };
}

/**
 * Measurements, newest first, each with BMI worked out from its own height or, when height wasn't taken that day, the most recent
 * height taken before it (adults' height rarely changes, so coaches don't re-measure it every visit).
 */
function measurementsView(rows: Parameters<typeof measurementView>[0][]) {
  const oldestFirst = [...rows].sort((a, b) => a.date.getTime() - b.date.getTime());
  let height: number | null = null;
  const views = oldestFirst.map((m) => {
    height = m.heightCm ?? height;
    return { ...measurementView(m), bmi: bmi(m.weightKg, m.heightCm ?? height) };
  });
  return views.reverse();
}

async function newInvite(userId: string, createdById: string) {
  const token = crypto.randomBytes(32).toString("base64url");
  await prisma.$transaction([
    // One live link at a time: a new one replaces any earlier one.
    prisma.accountInvite.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } }),
    prisma.accountInvite.create({ data: { userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000), createdById } }),
  ]);
  return { link: `${env.appUrl}/invite?token=${token}`, expiresInDays: INVITE_DAYS };
}

export interface NewClient {
  name: string;
  dateOfBirth: string;
  gender?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  occupation?: string | null;
  maritalStatus?: string | null;
  tracksCycle: boolean;
  consent: true;
  guardianConsent?: boolean;
}

export const clientsService = {
  specialities: () => SPECIALITIES,
  form: () => ({ version: INTAKE_VERSION, sections: INTAKE }),

  /** Her clients, with the next follow-up any of her visible consultations set. */
  async list(coachId: string) {
    const specs = await coachSpecs(coachId);
    const links = await prisma.clientCoach.findMany({
      where: { coachId },
      include: {
        client: {
          select: {
            id: true, name: true, dateOfBirth: true, claimedAt: true, addedByCoach: true,
            clientProfile: { select: { gender: true } },
            consultationsAbout: { select: { area: true, date: true, nextFollowUp: true }, orderBy: { date: "desc" } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    const today = todayUtc();
    return links.map(({ client: c }) => {
      const mine = c.consultationsAbout.filter((x) => canSeeConsultation(x.area as Speciality, specs));
      const upcoming = mine.map((x) => iso(x.nextFollowUp)).filter((d): d is string => !!d && d >= today).sort()[0] ?? null;
      return {
        id: c.id,
        name: c.name,
        age: c.dateOfBirth ? ageOn(iso(c.dateOfBirth)!, today) : null,
        gender: c.clientProfile?.gender ?? null,
        lastSeen: iso(mine[0]?.date ?? null),
        nextFollowUp: upcoming,
        usesApp: !c.addedByCoach || c.claimedAt !== null,
      };
    });
  },

  async create(coachId: string, isDemo: boolean, input: NewClient) {
    const dob = checkBirth(input.dateOfBirth, !!input.guardianConsent);
    const email = input.email?.trim().toLowerCase() || null;
    if (email && (await prisma.user.findUnique({ where: { email } }))) {
      // Never attach a coach to someone's own account without her: she shares from her Settings instead.
      throw new ConflictError("This person already has a Women360 account. Ask her to add you under Settings, Privacy & sharing.");
    }
    const client = await prisma.user.create({
      data: {
        name: input.name,
        email: email ?? `${crypto.randomUUID()}@${PLACEHOLDER_DOMAIN}`,
        passwordHash: await hashPassword(crypto.randomBytes(32).toString("base64url")),
        dateOfBirth: dob,
        avatarInitials: initials(input.name),
        onboarded: true,
        addedByCoach: true,
        isDemo,
        cycleTracking: input.tracksCycle,
        clientProfile: {
          create: {
            gender: input.gender ?? null, phone: input.phone ?? null, address: input.address ?? null, occupation: input.occupation ?? null,
            maritalStatus: input.maritalStatus ?? null, consentAt: new Date(), consentById: coachId, guardianConsent: !!input.guardianConsent,
          },
        },
        clientCoaches: { create: { coachId, addedById: coachId } },
      },
      select: { id: true },
    });
    await recordAudit({ actorId: coachId, actorRole: "COACH", action: "client.created", targetType: "User", targetId: client.id });
    return client;
  },

  /** Her record, cut to the sections this coach's specialities cover. Every opening is in the audit log. */
  async record(coachId: string, clientId: string) {
    await assertCoachOf(coachId, clientId);
    const specs = await coachSpecs(coachId);
    const sections = visibleSections(specs);
    const c = await prisma.user.findUniqueOrThrow({
      where: { id: clientId },
      include: {
        clientProfile: true,
        clientIntake: true,
        clientMeasurements: { orderBy: { date: "desc" } },
        consultationsAbout: { orderBy: { date: "desc" }, include: { coach: { select: { id: true, name: true } } } },
        clientCoaches: { include: { coach: { select: { id: true, name: true, coachSpecialities: true } } }, orderBy: { createdAt: "asc" } },
        accountInvites: { where: { usedAt: null, expiresAt: { gt: new Date() } }, select: { expiresAt: true }, take: 1 },
      },
    });
    await recordAudit({ actorId: coachId, actorRole: "COACH", action: "client.viewed", targetType: "User", targetId: clientId, metadata: { sections } });
    const intake = c.clientIntake;
    const p = c.clientProfile;
    const showIntake = (s: IntakeSection) => (sections.includes(s) && !(s === "menstrual" && !c.cycleTracking) ? ((intake?.[s] as Prisma.JsonObject | null) ?? {}) : undefined);
    return {
      id: c.id,
      basic: {
        name: c.name,
        dateOfBirth: iso(c.dateOfBirth),
        age: c.dateOfBirth ? ageOn(iso(c.dateOfBirth)!, todayUtc()) : null,
        gender: p?.gender ?? null,
        email: isPlaceholder(c.email) ? null : c.email,
        phone: p?.phone ?? null,
        address: p?.address ?? null,
        occupation: p?.occupation ?? null,
        maritalStatus: p?.maritalStatus ?? null,
        tracksCycle: c.cycleTracking,
        consentAt: p?.consentAt ?? null,
      },
      mySpecialities: specs,
      sections: sections.filter((s) => !(s === "menstrual" && !c.cycleTracking)),
      measurements: sections.includes("measurements") ? measurementsView(c.clientMeasurements) : undefined,
      intake: { lifestyle: showIntake("lifestyle"), medical: showIntake("medical"), menstrual: showIntake("menstrual"), dietary: showIntake("dietary") },
      consultations: c.consultationsAbout
        .filter((x) => canSeeConsultation(x.area as Speciality, specs))
        .map((x) => ({
          id: x.id, area: x.area, date: iso(x.date), targetWeightKg: x.targetWeightKg, targetDate: iso(x.targetDate), planGiven: x.planGiven,
          nextFollowUp: iso(x.nextFollowUp), notes: x.notes, coach: x.coach ? { name: x.coach.name } : null, mine: x.coach?.id === coachId,
        })),
      coaches: c.clientCoaches.map((l) => ({ id: l.coach.id, name: l.coach.name, specialities: effective(l.coach.coachSpecialities as Speciality[]) })),
      app: {
        usesApp: !c.addedByCoach || c.claimedAt !== null,
        inviteActiveUntil: c.accountInvites[0]?.expiresAt ?? null,
        canInvite: c.addedByCoach && c.claimedAt === null && !c.isDemo && (c.dateOfBirth ? ageOn(iso(c.dateOfBirth)!, todayUtc()) >= ADULT : false),
      },
    };
  },

  /**
   * Her last 14 days of daily logs, only the kinds this coach's specialities cover (food, movement, mood, sleep, cycle), one row a day.
   * Totals and ratings only: her written notes are never included.
   */
  async logs(coachId: string, clientId: string, today: string) {
    await assertCoachOf(coachId, clientId);
    const kinds = visibleLogs(await coachSpecs(coachId));
    const end = asDate(today);
    const from = new Date(end.getTime() - 13 * 86_400_000);
    const where = { userId: clientId, date: { gte: from, lte: end } };
    const has = (k: string) => kinds.includes(k as never);
    const [meals, water, fruit, activity, steps, mood, sleep, cycle] = await Promise.all([
      has("food") ? prisma.mealEntry.groupBy({ by: ["date"], where, _count: true, _sum: { calories: true, proteinG: true } }) : [],
      has("food") ? prisma.hydrationLog.groupBy({ by: ["date"], where, _sum: { amountMl: true } }) : [],
      has("food") ? prisma.fruitVegLog.groupBy({ by: ["date"], where, _sum: { servings: true } }) : [],
      has("movement") ? prisma.activityEntry.groupBy({ by: ["date"], where, _sum: { durationMinutes: true } }) : [],
      has("movement") ? prisma.stepsLog.findMany({ where, select: { date: true, steps: true } }) : [],
      has("mind") ? prisma.wellbeingEntry.findMany({ where, select: { date: true, mood: true, stress: true, energy: true } }) : [],
      has("sleep") ? prisma.sleepEntry.findMany({ where, select: { date: true, durationHours: true, quality: true } }) : [],
      has("cycle") ? prisma.cycleEntry.findMany({ where, select: { date: true, isPeriod: true, flow: true, symptoms: true } }) : [],
    ]);
    const days = new Map<string, Record<string, unknown>>();
    const row = (d: Date) => {
      const k = iso(d)!;
      if (!days.has(k)) days.set(k, { date: k });
      return days.get(k)!;
    };
    for (const m of meals) Object.assign(row(m.date), { meals: m._count, calories: Math.round(m._sum.calories ?? 0), proteinG: Math.round(m._sum.proteinG ?? 0) });
    for (const w of water) Object.assign(row(w.date), { waterMl: w._sum.amountMl ?? 0 });
    for (const f of fruit) Object.assign(row(f.date), { fruitVeg: f._sum.servings ?? 0 });
    for (const a of activity) Object.assign(row(a.date), { activeMinutes: a._sum.durationMinutes ?? 0 });
    for (const s of steps) Object.assign(row(s.date), { steps: s.steps });
    for (const w of mood) Object.assign(row(w.date), { mood: w.mood, stress: w.stress, energy: w.energy });
    for (const s of sleep) Object.assign(row(s.date), { sleepHours: s.durationHours, sleepQuality: s.quality });
    for (const c of cycle) Object.assign(row(c.date), { period: c.isPeriod, flow: c.flow, symptoms: c.symptoms.length });
    await recordAudit({ actorId: coachId, actorRole: "COACH", action: "client.logs_viewed", targetType: "User", targetId: clientId, metadata: { kinds } });
    return { kinds, days: [...days.values()].sort((a, b) => String(b.date).localeCompare(String(a.date))) };
  },

  async updateBasic(coachId: string, clientId: string, input: Partial<Omit<NewClient, "consent" | "email">> & { email?: string | null }) {
    await assertCoachOf(coachId, clientId);
    const c = await prisma.user.findUniqueOrThrow({ where: { id: clientId }, include: { clientProfile: true } });
    const claimed = !c.addedByCoach || c.claimedAt !== null;
    const user: Prisma.UserUpdateInput = {};
    if (input.name !== undefined) Object.assign(user, { name: input.name, avatarInitials: initials(input.name) });
    if (input.dateOfBirth !== undefined) user.dateOfBirth = checkBirth(input.dateOfBirth, input.guardianConsent ?? !!c.clientProfile?.guardianConsent);
    if (input.tracksCycle !== undefined) user.cycleTracking = input.tracksCycle;
    // Her sign-in address is hers to change once she uses the app; before that, the coach can add or correct it.
    if (input.email !== undefined && !claimed) {
      const email = input.email?.trim().toLowerCase() || null;
      if (email && email !== c.email && (await prisma.user.findUnique({ where: { email } }))) throw new ConflictError("Another account already uses that address.");
      user.email = email ?? `${crypto.randomUUID()}@${PLACEHOLDER_DOMAIN}`;
    }
    const profile = {
      gender: input.gender, phone: input.phone, address: input.address, occupation: input.occupation, maritalStatus: input.maritalStatus,
      ...(input.guardianConsent !== undefined ? { guardianConsent: input.guardianConsent } : {}),
    };
    await prisma.user.update({ where: { id: clientId }, data: { ...user, clientProfile: { update: profile } } });
    await recordAudit({ actorId: coachId, actorRole: "COACH", action: "client.updated", targetType: "User", targetId: clientId, metadata: { fields: Object.keys(input) } });
    return { ok: true };
  },

  async saveSection(coachId: string, clientId: string, section: IntakeSection, answers: Record<string, unknown>) {
    await assertCoachOf(coachId, clientId);
    if (!canSee(section as Section, await coachSpecs(coachId))) throw new ForbiddenError("This section is for another speciality.");
    const checked = checkSection(section, answers);
    if (!checked.ok) throw new BadRequestError(checked.error);
    const data = { [section]: checked.answers as Prisma.InputJsonValue, schemaVersion: INTAKE_VERSION, updatedById: coachId };
    await prisma.clientIntake.upsert({ where: { userId: clientId }, create: { userId: clientId, ...data }, update: data });
    // Her cycle lengths carry over to her own cycle tracker, so predictions start from what she told her coach.
    if (section === "menstrual") {
      const a = checked.answers as { cycleLength?: number; periodLength?: number };
      if (a.cycleLength || a.periodLength) {
        const current = await prisma.cycleProfile.findUnique({ where: { userId: clientId } });
        const cycle = Math.min(60, Math.max(21, a.cycleLength ?? current?.averageCycleLength ?? 28));
        const period = Math.min(10, Math.max(2, a.periodLength ?? current?.averagePeriodLength ?? 5));
        await prisma.cycleProfile.upsert({ where: { userId: clientId }, create: { userId: clientId, averageCycleLength: cycle, averagePeriodLength: period }, update: { averageCycleLength: cycle, averagePeriodLength: period } });
      }
    }
    await recordAudit({ actorId: coachId, actorRole: "COACH", action: "client.section_saved", targetType: "User", targetId: clientId, metadata: { section } });
    return { section, answers: checked.answers };
  },

  async addMeasurement(coachId: string, clientId: string, m: { date: string; heightCm?: number | null; weightKg?: number | null; waistCm?: number | null; hipCm?: number | null; chestCm?: number | null; armCm?: number | null; thighCm?: number | null }) {
    await assertCoachOf(coachId, clientId);
    if (!canSee("measurements", await coachSpecs(coachId))) throw new ForbiddenError("Measurements are for another speciality.");
    const values = [m.heightCm, m.weightKg, m.waistCm, m.hipCm, m.chestCm, m.armCm, m.thighCm];
    if (values.every((v) => v === undefined || v === null)) throw new BadRequestError("Enter at least one measurement.");
    const row = await prisma.clientMeasurement.create({ data: { ...m, date: asDate(m.date), userId: clientId, recordedById: coachId } });
    // Her weight also goes to her own measurements, so her app and its calorie estimates use it.
    if (m.weightKg) await prisma.vitalMeasurement.create({ data: { userId: clientId, type: "WEIGHT", value: `${m.weightKg} kg`, date: asDate(m.date) } }).catch(() => undefined);
    return measurementView(row);
  },

  async deleteMeasurement(coachId: string, clientId: string, id: string) {
    await assertCoachOf(coachId, clientId);
    if (!canSee("measurements", await coachSpecs(coachId))) throw new ForbiddenError();
    const res = await prisma.clientMeasurement.deleteMany({ where: { id, userId: clientId } });
    if (res.count === 0) throw new NotFoundError();
  },

  async addConsultation(coachId: string, clientId: string, input: { area: Speciality; date: string; targetWeightKg?: number | null; targetDate?: string | null; planGiven?: string | null; nextFollowUp?: string | null; notes?: string | null }) {
    await assertCoachOf(coachId, clientId);
    const specs = await coachSpecs(coachId);
    if (!specs.includes(input.area) && !specs.includes("GENERAL")) throw new ForbiddenError("Write a consultation in one of your own specialities.");
    const row = await prisma.consultation.create({
      data: {
        clientId, coachId, area: input.area as CoachSpeciality, date: asDate(input.date), targetWeightKg: input.targetWeightKg ?? null,
        targetDate: input.targetDate ? asDate(input.targetDate) : null, planGiven: input.planGiven ?? null,
        nextFollowUp: input.nextFollowUp ? asDate(input.nextFollowUp) : null, notes: input.notes ?? null,
      },
    });
    await recordAudit({ actorId: coachId, actorRole: "COACH", action: "client.consultation_added", targetType: "User", targetId: clientId, metadata: { area: input.area } });
    return { id: row.id };
  },

  /** A coach changes or removes only consultations she wrote. */
  async updateConsultation(coachId: string, id: string, input: Record<string, unknown> | null) {
    const row = await prisma.consultation.findUnique({ where: { id } });
    if (!row || row.coachId !== coachId) throw new NotFoundError("We couldn't find that consultation.");
    await assertCoachOf(coachId, row.clientId);
    if (input === null) {
      await prisma.consultation.delete({ where: { id } });
      return { ok: true };
    }
    const i = input as { date?: string; targetWeightKg?: number | null; targetDate?: string | null; planGiven?: string | null; nextFollowUp?: string | null; notes?: string | null };
    await prisma.consultation.update({
      where: { id },
      data: {
        ...(i.date ? { date: asDate(i.date) } : {}),
        ...(i.targetWeightKg !== undefined ? { targetWeightKg: i.targetWeightKg } : {}),
        ...(i.targetDate !== undefined ? { targetDate: i.targetDate ? asDate(i.targetDate) : null } : {}),
        ...(i.planGiven !== undefined ? { planGiven: i.planGiven } : {}),
        ...(i.nextFollowUp !== undefined ? { nextFollowUp: i.nextFollowUp ? asDate(i.nextFollowUp) : null } : {}),
        ...(i.notes !== undefined ? { notes: i.notes } : {}),
      },
    });
    return { ok: true };
  },

  /** Every coach in the practice and what they specialise in, so a coach can bring in the right colleague. */
  async directory(isDemo: boolean) {
    const coaches = await prisma.user.findMany({ where: { role: "COACH", deletedAt: null, isDemo }, select: { id: true, name: true, coachSpecialities: true }, orderBy: { name: "asc" } });
    return coaches.map((c) => ({ id: c.id, name: c.name, specialities: effective(c.coachSpecialities as Speciality[]) }));
  },

  async addCoach(coachId: string, clientId: string, otherCoachId: string) {
    await assertCoachOf(coachId, clientId);
    const [other, client] = await Promise.all([
      prisma.user.findFirst({ where: { id: otherCoachId, role: "COACH", deletedAt: null } }),
      prisma.user.findUniqueOrThrow({ where: { id: clientId }, select: { isDemo: true, name: true } }),
    ]);
    if (!other || other.isDemo !== client.isDemo) throw new BadRequestError("Choose a coach from the list.");
    await prisma.clientCoach.upsert({ where: { clientId_coachId: { clientId, coachId: otherCoachId } }, create: { clientId, coachId: otherCoachId, addedById: coachId }, update: {} });
    await prisma.notification.create({ data: { userId: otherCoachId, title: "A new client", detail: `A colleague added you as one of ${client.name}'s coaches.` } });
    await recordAudit({ actorId: coachId, actorRole: "COACH", action: "client.coach_added", targetType: "User", targetId: clientId, metadata: { coachId: otherCoachId } });
    return { ok: true };
  },

  /** A coach leaves a client's care. The last coach of a record the client hasn't claimed can't leave it: delete it instead. */
  async leave(coachId: string, clientId: string) {
    await assertCoachOf(coachId, clientId);
    const [count, client] = await Promise.all([prisma.clientCoach.count({ where: { clientId } }), prisma.user.findUniqueOrThrow({ where: { id: clientId }, select: { addedByCoach: true, claimedAt: true } })]);
    if (count === 1 && client.addedByCoach && !client.claimedAt) throw new ConflictError("You're this client's only coach. Remove the record instead, or add another coach first.");
    await prisma.clientCoach.delete({ where: { clientId_coachId: { clientId, coachId } } });
    await recordAudit({ actorId: coachId, actorRole: "COACH", action: "client.coach_left", targetType: "User", targetId: clientId });
    return { ok: true };
  },

  /** Removes a record the client never claimed, with everything in it. A claimed account is hers: only she can delete it. */
  async remove(coachId: string, clientId: string) {
    await assertCoachOf(coachId, clientId);
    const c = await prisma.user.findUniqueOrThrow({ where: { id: clientId }, select: { addedByCoach: true, claimedAt: true } });
    if (!c.addedByCoach || c.claimedAt) throw new ConflictError("She uses this account herself, so only she can delete it. You can leave her care instead.");
    await prisma.user.delete({ where: { id: clientId } });
    await recordAudit({ actorId: coachId, actorRole: "COACH", action: "client.deleted", targetType: "User" });
  },

  async invite(coachId: string, clientId: string) {
    await assertCoachOf(coachId, clientId);
    const c = await prisma.user.findUniqueOrThrow({ where: { id: clientId } });
    if (!c.addedByCoach || c.claimedAt) throw new ConflictError("She already uses the app.");
    if (c.isDemo) throw new ForbiddenError("Invites aren't available for demonstration records.");
    if (!c.dateOfBirth || ageOn(iso(c.dateOfBirth)!, todayUtc()) < ADULT) throw new ForbiddenError("Only adults can sign in to Women360. Her coaches keep her record.");
    const result = await newInvite(clientId, coachId);
    await recordAudit({ actorId: coachId, actorRole: "COACH", action: "client.invite_created", targetType: "User", targetId: clientId });
    return result;
  },
};

/** The claim link: what the page shows before she sets a password, then the claim itself (which signs her in). */
export const inviteService = {
  async peek(token: string) {
    const inv = await prisma.accountInvite.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: { select: { name: true, email: true, role: true } } } });
    if (!inv || inv.usedAt || inv.expiresAt < new Date()) throw new NotFoundError("This link has expired or was already used. Ask for a new one.");
    return { name: inv.user.name, role: inv.user.role, email: isPlaceholder(inv.user.email) ? null : inv.user.email };
  },

  async claim(token: string, input: { password: string; email?: string | null; agreed: true }) {
    const inv = await prisma.accountInvite.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
    if (!inv || inv.usedAt || inv.expiresAt < new Date()) throw new NotFoundError("This link has expired or was already used. Ask for a new one.");
    const u = inv.user;
    let email = u.email;
    if (isPlaceholder(u.email)) {
      const wanted = input.email?.trim().toLowerCase();
      if (!wanted) throw new BadRequestError("Enter the email address you'll sign in with.");
      if (await prisma.user.findUnique({ where: { email: wanted } })) throw new ConflictError("That address is already used by another account.");
      email = wanted;
    }
    assertPasswordAcceptable(input.password, { email, name: u.name });
    const user = await prisma.user.update({
      where: { id: u.id },
      data: { email, passwordHash: await hashPassword(input.password), claimedAt: new Date(), sessionsValidAfter: new Date() },
    });
    await prisma.accountInvite.update({ where: { id: inv.id }, data: { usedAt: new Date() } });
    await recordAudit({ actorId: u.id, actorRole: u.role, action: "account.claimed", targetType: "User", targetId: u.id });
    const session = await issueSession(user.id, user.role);
    return { user: publicUser(user), ...session };
  },
};

/** The client's side: who her coaches are, what they've recorded (their private working notes excepted), and removing one. */
export const myCoachingService = {
  async overview(userId: string) {
    const c = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        clientProfile: true,
        clientIntake: true,
        clientMeasurements: { orderBy: { date: "desc" } },
        consultationsAbout: { orderBy: { date: "desc" }, include: { coach: { select: { name: true } } } },
        clientCoaches: { include: { coach: { select: { id: true, name: true, coachSpecialities: true } } } },
      },
    });
    return {
      coaches: c.clientCoaches.map((l) => ({ id: l.coach.id, name: l.coach.name, specialities: effective(l.coach.coachSpecialities as Speciality[]) })),
      profile: c.clientProfile ? { gender: c.clientProfile.gender, phone: c.clientProfile.phone, address: c.clientProfile.address, occupation: c.clientProfile.occupation, maritalStatus: c.clientProfile.maritalStatus } : null,
      intake: c.clientIntake ? { lifestyle: c.clientIntake.lifestyle, medical: c.clientIntake.medical, menstrual: c.clientIntake.menstrual, dietary: c.clientIntake.dietary } : null,
      measurements: measurementsView(c.clientMeasurements),
      plans: c.consultationsAbout.map((x) => ({ id: x.id, area: x.area, date: iso(x.date), coach: x.coach?.name ?? null, planGiven: x.planGiven, targetWeightKg: x.targetWeightKg, targetDate: iso(x.targetDate), nextFollowUp: iso(x.nextFollowUp) })),
    };
  },

  async removeCoach(userId: string, coachId: string) {
    const res = await prisma.clientCoach.deleteMany({ where: { clientId: userId, coachId } });
    if (res.count === 0) throw new NotFoundError();
    await recordAudit({ actorId: userId, actorRole: "WOMAN", action: "client.coach_removed_by_client", targetType: "User", targetId: coachId });
    return { ok: true };
  },
};

/** Administrators: specialities, new coach accounts (claimed through the same one-time link), and moving clients between coaches. */
export const adminCoachesService = {
  async coaches(isDemo: boolean) {
    const list = await prisma.user.findMany({
      where: { role: "COACH", deletedAt: null, isDemo },
      select: { id: true, name: true, email: true, coachSpecialities: true, addedByCoach: true, claimedAt: true, _count: { select: { coachClients: true } } },
      orderBy: { name: "asc" },
    });
    return list.map((c) => ({ id: c.id, name: c.name, email: c.email, specialities: c.coachSpecialities, clients: c._count.coachClients, pending: c.addedByCoach && !c.claimedAt }));
  },

  async setSpecialities(adminId: string, coachId: string, specialities: Speciality[]) {
    const c = await prisma.user.findFirst({ where: { id: coachId, role: "COACH", isDemo: false } });
    if (!c) throw new NotFoundError();
    await prisma.user.update({ where: { id: coachId }, data: { coachSpecialities: [...new Set(specialities)] as CoachSpeciality[] } });
    await recordAudit({ actorId: adminId, actorRole: "ADMIN", action: "coach.specialities_set", targetType: "User", targetId: coachId, metadata: { specialities } });
    return { ok: true };
  },

  /** A coach account for a new colleague, claimed through a one-time link the administrator sends them. */
  async createCoach(adminId: string, input: { name: string; email: string; specialities: Speciality[] }) {
    const email = input.email.trim().toLowerCase();
    if (await prisma.user.findUnique({ where: { email } })) throw new ConflictError("An account already uses that address. Change that account's role under Users instead.");
    const coach = await prisma.user.create({
      data: {
        name: input.name, email, role: "COACH", onboarded: true, addedByCoach: true, avatarInitials: initials(input.name),
        passwordHash: await hashPassword(crypto.randomBytes(32).toString("base64url")), coachSpecialities: [...new Set(input.specialities)] as CoachSpeciality[],
      },
    });
    await recordAudit({ actorId: adminId, actorRole: "ADMIN", action: "coach.created", targetType: "User", targetId: coach.id });
    return { id: coach.id, ...(await newInvite(coach.id, adminId)) };
  },

  async newCoachLink(adminId: string, coachId: string) {
    const c = await prisma.user.findFirst({ where: { id: coachId, role: "COACH", isDemo: false, addedByCoach: true, claimedAt: null } });
    if (!c) throw new ConflictError("This coach already has a password.");
    return newInvite(coachId, adminId);
  },
};
