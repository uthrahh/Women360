import { prisma } from "@/lib/prisma";
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
  async updateProfile(
    userId: string,
    input: { name?: string; dateOfBirth?: string; lifeStage?: LifeStage }
  ) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        name: input.name,
        dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined,
        lifeStage: input.lifeStage,
      },
    });
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
