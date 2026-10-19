import { prisma } from "@/lib/prisma";
import { publicUser } from "@/lib/publicUser";
import type { LifeStage, SeniorEssentialKey } from "@prisma/client";

const DEFAULT_ESSENTIALS: { key: SeniorEssentialKey; enabled: boolean }[] = [
  { key: "HEALTH", enabled: true },
  { key: "MEDICINES", enabled: true },
  { key: "APPOINTMENTS", enabled: true },
  { key: "ACTIVITY", enabled: true },
  { key: "SLEEP", enabled: true },
  { key: "NUTRITION", enabled: false },
  { key: "MESSAGES", enabled: true },
  { key: "CYCLE", enabled: false },
  { key: "EMERGENCY", enabled: true },
];

export const usersService = {
  /**
   * Everything the app holds about this person, as plain JSON they can keep.
   * Built from an explicit list of their own tables, so credentials (password
   * hash, two-factor secrets, backup codes, refresh tokens) are never in it.
   */
  async exportData(userId: string) {
    const u = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        healthProfile: true,
        emergencyContact: true,
        seniorEssentials: true,
        nutritionGoal: true,
        activityGoal: true,
        cycleProfile: true,
        cycleEntries: true,
        mealEntries: true,
        hydrationLogs: true,
        fruitVegLogs: true,
        activityEntries: true,
        stepsLogs: true,
        sleepEntries: true,
        wellbeingEntries: true,
        goals: { include: { checkIns: true } },
        appointments: true,
        medications: true,
        medicationLogs: true,
        vitals: true,
        reports: true,
        notifications: true,
        receivedMessages: true,
        feedback: true,
      },
    });
    return {
      exportedAt: new Date().toISOString(),
      format: "women360-export-v1",
      account: publicUser(u),
      healthProfile: u.healthProfile,
      emergencyContact: u.emergencyContact,
      seniorEssentials: u.seniorEssentials,
      nutritionGoal: u.nutritionGoal,
      activityGoal: u.activityGoal,
      cycleProfile: u.cycleProfile,
      cycleEntries: u.cycleEntries,
      mealEntries: u.mealEntries,
      hydrationLogs: u.hydrationLogs,
      fruitVegLogs: u.fruitVegLogs,
      activityEntries: u.activityEntries,
      stepsLogs: u.stepsLogs,
      sleepEntries: u.sleepEntries,
      wellbeingEntries: u.wellbeingEntries,
      goals: u.goals,
      appointments: u.appointments,
      medications: u.medications,
      medicationLogs: u.medicationLogs,
      vitals: u.vitals,
      reports: u.reports,
      notifications: u.notifications,
      messages: u.receivedMessages,
      feedback: u.feedback,
    };
  },

  async updateProfile(
    userId: string,
    input: { name?: string; dateOfBirth?: string; lifeStage?: LifeStage }
  ) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        name: input.name,
        dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined,
        lifeStage: input.lifeStage,
      },
    });
    return publicUser(user);
  },

  async getEmergencyContact(userId: string) {
    return prisma.emergencyContact.findUnique({ where: { userId } });
  },

  async upsertEmergencyContact(
    userId: string,
    input: { name: string; phone: string; relationship?: string }
  ) {
    return prisma.emergencyContact.upsert({
      where: { userId },
      create: { userId, ...input },
      update: input,
    });
  },

  async listSeniorEssentials(userId: string) {
    const existing = await prisma.seniorEssentialPreference.findMany({ where: { userId } });
    if (existing.length > 0) return existing;

    // Lazily seed sensible defaults on first access rather than at
    // registration time, so the default set can change without a migration
    // that touches every existing user.
    await prisma.seniorEssentialPreference.createMany({
      data: DEFAULT_ESSENTIALS.map((e) => ({ userId, ...e })),
    });
    return prisma.seniorEssentialPreference.findMany({ where: { userId } });
  },

  async toggleSeniorEssential(userId: string, key: SeniorEssentialKey, enabled: boolean) {
    return prisma.seniorEssentialPreference.upsert({
      where: { userId_key: { userId, key } },
      create: { userId, key, enabled },
      update: { enabled },
    });
  },

  async getHealthProfile(userId: string) {
    return prisma.healthProfile.findUnique({ where: { userId } });
  },

  async upsertHealthProfile(
    userId: string,
    input: { allergies?: string[]; conditions?: string[]; familyHistory?: string; notes?: string }
  ) {
    return prisma.healthProfile.upsert({
      where: { userId },
      create: { userId, ...input },
      update: input,
    });
  },
};
