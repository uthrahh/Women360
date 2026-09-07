import { prisma } from "@/lib/prisma";
import { BadRequestError, ForbiddenError } from "@/lib/errors";

async function assertActiveAssignment(coachId: string, womanId: string) {
  const assignment = await prisma.coachAssignment.findUnique({
    where: { womanId_coachId: { womanId, coachId } },
  });
  // BR-02: a coach never gets unrestricted access — only an active,
  // woman-granted assignment unlocks anything about that woman.
  if (!assignment || !assignment.active) {
    throw new ForbiddenError("You don't have permission to view this person's information.");
  }
}

export const coachService = {
  // Granted by the Woman, from her own Settings → Privacy & sharing.
  async grantAccess(womanId: string, coachEmail: string) {
    const coach = await prisma.user.findFirst({ where: { email: coachEmail, role: "COACH", deletedAt: null } });
    if (!coach) throw new BadRequestError("No wellness coach account was found with that email.");
    return prisma.coachAssignment.upsert({
      where: { womanId_coachId: { womanId, coachId: coach.id } },
      create: { womanId, coachId: coach.id, active: true },
      update: { active: true },
    });
  },

  async revokeAccess(womanId: string, coachId: string) {
    await prisma.coachAssignment.updateMany({
      where: { womanId, coachId },
      data: { active: false },
    });
  },

  async listMySharing(womanId: string) {
    return prisma.coachAssignment.findMany({
      where: { womanId, active: true },
      include: { coach: { select: { id: true, name: true, email: true } } },
    });
  },

  async listAssignedWomen(coachId: string) {
    const assignments = await prisma.coachAssignment.findMany({
      where: { coachId, active: true },
      include: { woman: { select: { id: true, name: true, avatarInitials: true, lifeStage: true } } },
    });
    return assignments.map((a) => a.woman);
  },

  /**
   * Coaching summary only — deliberately excludes HealthProfile and
   * Medications, which stay woman-only at this phase (least privilege,
   * SRS §6.3). Extend the permitted fields here, explicitly, if the
   * product later needs the coach to see more.
   */
  async getWomanSummary(coachId: string, womanId: string) {
    await assertActiveAssignment(coachId, womanId);
    const [goals, wellbeing, sleep, activity, appointments] = await Promise.all([
      prisma.goal.findMany({ where: { userId: womanId } }),
      prisma.wellbeingEntry.findMany({ where: { userId: womanId }, orderBy: { date: "desc" }, take: 14 }),
      prisma.sleepEntry.findMany({ where: { userId: womanId }, orderBy: { date: "desc" }, take: 14 }),
      prisma.activityEntry.findMany({ where: { userId: womanId }, orderBy: { date: "desc" }, take: 14 }),
      prisma.appointment.findMany({ where: { userId: womanId, kind: "COACH" }, orderBy: { date: "asc" } }),
    ]);
    return { goals, wellbeing, sleep, activity, appointments };
  },

  async addNote(coachId: string, womanId: string, input: { note: string; visibleToWoman: boolean }) {
    await assertActiveAssignment(coachId, womanId);
    return prisma.coachNote.create({ data: { coachId, womanId, ...input } });
  },

  async listNotes(coachId: string, womanId: string) {
    await assertActiveAssignment(coachId, womanId);
    return prisma.coachNote.findMany({ where: { coachId, womanId }, orderBy: { createdAt: "desc" } });
  },

  async listNotesForWoman(womanId: string) {
    // The woman only ever sees notes her coach chose to make visible to her.
    return prisma.coachNote.findMany({
      where: { womanId, visibleToWoman: true },
      orderBy: { createdAt: "desc" },
      include: { coach: { select: { name: true } } },
    });
  },
};
