import { prisma } from "@/lib/prisma";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import type { AppointmentKind, VitalType } from "@prisma/client";

interface AppointmentInput {
  title: string;
  provider: string;
  date: string;
  time: string;
  location: string;
  kind: AppointmentKind;
}

interface MedicationInput {
  name: string;
  dose: string;
  schedule: string;
  remaining?: number;
}

interface VitalInput {
  type: VitalType;
  value: string;
  date: string;
}

async function assertOwner<T extends { userId: string } | null>(
  record: T,
  userId: string,
  notFoundMessage: string
): asserts record is NonNullable<T> {
  if (!record) throw new NotFoundError(notFoundMessage);
  if (record.userId !== userId) throw new ForbiddenError();
}

export const healthService = {
  // Appointments ------------------------------------------------------
  async listAppointments(userId: string) {
    return prisma.appointment.findMany({ where: { userId }, orderBy: { date: "asc" } });
  },
  async createAppointment(userId: string, input: AppointmentInput) {
    return prisma.appointment.create({ data: { ...input, userId, date: new Date(input.date) } });
  },
  async updateAppointment(userId: string, id: string, input: Partial<AppointmentInput>) {
    const existing = await prisma.appointment.findUnique({ where: { id } });
    assertOwner(existing, userId, "Appointment not found.");
    const { date, ...rest } = input;
    return prisma.appointment.update({
      where: { id },
      data: { ...rest, ...(date ? { date: new Date(date) } : {}) },
    });
  },
  async deleteAppointment(userId: string, id: string) {
    const existing = await prisma.appointment.findUnique({ where: { id } });
    assertOwner(existing, userId, "Appointment not found.");
    await prisma.appointment.delete({ where: { id } });
  },

  // Medications ---------------------------------------------------------
  async listMedications(userId: string) {
    return prisma.medication.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  },
  async createMedication(userId: string, input: MedicationInput) {
    return prisma.medication.create({ data: { ...input, userId } });
  },
  async updateMedication(userId: string, id: string, input: Partial<MedicationInput>) {
    const existing = await prisma.medication.findUnique({ where: { id } });
    assertOwner(existing, userId, "Medication not found.");
    return prisma.medication.update({ where: { id }, data: input });
  },
  async deleteMedication(userId: string, id: string) {
    const existing = await prisma.medication.findUnique({ where: { id } });
    assertOwner(existing, userId, "Medication not found.");
    await prisma.medication.delete({ where: { id } });
  },

  // Vitals ---------------------------------------------------------------
  async listVitals(userId: string) {
    return prisma.vitalMeasurement.findMany({ where: { userId }, orderBy: { date: "desc" }, take: 100 });
  },
  async addVital(userId: string, input: VitalInput) {
    return prisma.vitalMeasurement.create({ data: { ...input, userId, date: new Date(input.date) } });
  },
};
