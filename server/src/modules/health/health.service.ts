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
  times?: string[];
  remaining?: number;
}

type MedicationDoseStatus = "TAKEN" | "SKIPPED" | "PENDING" | "OVERDUE";

function doseDateTime(dayISO: string, time: string): Date {
  return new Date(`${dayISO}T${time}:00`);
}

interface VitalInput {
  type: VitalType;
  value: string;
  date: string;
}

function assertOwner<T extends { userId: string } | null>(
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

  // Materializes today's expected doses from each medication's `times`,
  // classified against any recorded MedicationLog — a dose with no log yet
  // is PENDING (still ahead) or OVERDUE (its time has passed), never
  // silently assumed taken. In-app only: there is no push-notification
  // infra behind this, which the UI states rather than overpromising.
  async getTodayMedications(userId: string) {
    const medications = await prisma.medication.findMany({ where: { userId, NOT: { times: { isEmpty: true } } } });
    if (medications.length === 0) return [];

    const todayISO = new Date().toISOString().slice(0, 10);
    const scheduledTimes = medications.flatMap((m) => m.times.map((t) => doseDateTime(todayISO, t)));
    const logs = await prisma.medicationLog.findMany({
      where: { userId, scheduledFor: { in: scheduledTimes } },
    });
    const logByKey = new Map(logs.map((l) => [`${l.medicationId}|${l.scheduledFor.toISOString()}`, l]));

    const now = Date.now();
    return medications
      .flatMap((m) =>
        m.times.map((t) => {
          const scheduledFor = doseDateTime(todayISO, t);
          const log = logByKey.get(`${m.id}|${scheduledFor.toISOString()}`);
          const status: MedicationDoseStatus = log ? log.status : scheduledFor.getTime() < now ? "OVERDUE" : "PENDING";
          return { medicationId: m.id, medicationName: m.name, dose: m.dose, scheduledFor, status };
        })
      )
      .sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime());
  },

  async logMedicationDose(userId: string, medicationId: string, scheduledFor: string, status: "TAKEN" | "SKIPPED") {
    const medication = await prisma.medication.findUnique({ where: { id: medicationId } });
    assertOwner(medication, userId, "Medication not found.");
    return prisma.medicationLog.upsert({
      where: { medicationId_scheduledFor: { medicationId, scheduledFor: new Date(scheduledFor) } },
      create: { medicationId, userId, scheduledFor: new Date(scheduledFor), status },
      update: { status, recordedAt: new Date() },
    });
  },

  // % of expected doses (up to now) actually marked taken over the window —
  // a skipped or never-logged past dose counts against the total, not just
  // an explicit "skip".
  async getAdherence(userId: string, days: number) {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (days - 1));
    const now = new Date();

    const medications = await prisma.medication.findMany({ where: { userId, NOT: { times: { isEmpty: true } } } });
    if (medications.length === 0) return { takenCount: 0, expectedCount: 0, pct: null as number | null };

    let expectedCount = 0;
    for (const m of medications) {
      // A dose can't be "expected" before the medicine was even added.
      const medicationStart = m.createdAt > since ? m.createdAt : since;
      for (let day = new Date(medicationStart); day <= now; day.setDate(day.getDate() + 1)) {
        const dayISO = day.toISOString().slice(0, 10);
        for (const t of m.times) {
          const scheduledFor = doseDateTime(dayISO, t);
          if (scheduledFor.getTime() >= medicationStart.getTime() && scheduledFor.getTime() <= now.getTime()) expectedCount++;
        }
      }
    }

    const logs = await prisma.medicationLog.findMany({
      where: { userId, scheduledFor: { gte: since, lte: now } },
    });
    const takenCount = logs.filter((l) => l.status === "TAKEN").length;
    // A dose the user actually logged always counts as expected, even if it
    // falls just before the medication's own createdAt (e.g. adding a
    // medicine and immediately logging this morning's already-taken dose).
    expectedCount = Math.max(expectedCount, logs.length);

    return { takenCount, expectedCount, pct: expectedCount > 0 ? Math.round((takenCount / expectedCount) * 100) : null };
  },

  // Vitals ---------------------------------------------------------------
  async listVitals(userId: string) {
    return prisma.vitalMeasurement.findMany({ where: { userId }, orderBy: { date: "desc" }, take: 100 });
  },
  async addVital(userId: string, input: VitalInput) {
    return prisma.vitalMeasurement.create({ data: { ...input, userId, date: new Date(input.date) } });
  },
};
