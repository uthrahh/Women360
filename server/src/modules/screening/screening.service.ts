import { prisma } from "@/lib/prisma";
import { BadRequestError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { dayNumber, toIsoDay } from "@/lib/streak";
import { DISCLAIMER, REGION, REVIEWED_ON, REVIEW_STATUS, SCREENINGS, SOURCES } from "./guidelines";
import { screeningState } from "./screening.logic";

const asDate = (day: string) => new Date(`${day}T00:00:00.000Z`);
const todayUtc = () => toIsoDay(new Date());

// A screening can be years old, so there is no backfill limit like habits have,
// only "not in the future" (a day of slack for timezones) and a sane floor.
const FUTURE_SLACK_DAYS = 1;
const MAX_YEARS_BACK = 40;

function assertPlausibleDone(day: string) {
  const offset = dayNumber(day) - dayNumber(todayUtc());
  if (offset > FUTURE_SLACK_DAYS) throw new BadRequestError("That date is in the future.");
  if (offset < -MAX_YEARS_BACK * 366) throw new BadRequestError("That date is too far back.");
}

export const screeningService = {
  async list(userId: string, today = todayUtc()) {
    const [user, records] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { dateOfBirth: true } }),
      prisma.screeningRecord.findMany({ where: { userId }, orderBy: [{ doneOn: "desc" }, { createdAt: "desc" }] }),
    ]);
    const dob = user.dateOfBirth ? toIsoDay(user.dateOfBirth) : null;

    const items = SCREENINGS.map((s) => {
      const latest = records.find((r) => r.screeningId === s.id) ?? null;
      const state = screeningState(s, dob, today, latest ? toIsoDay(latest.doneOn) : null);
      return {
        ...s,
        sources: s.sources.map((k) => SOURCES[k]),
        ...state,
        lastRecordId: latest?.id ?? null,
      };
    });

    return {
      region: REGION,
      reviewedOn: REVIEWED_ON,
      reviewStatus: REVIEW_STATUS,
      disclaimer: DISCLAIMER,
      hasDateOfBirth: dob !== null,
      items,
    };
  },

  async record(userId: string, screeningId: string, doneOn: string) {
    assertPlausibleDone(doneOn);
    // Tapping "done" twice for the same day must not stack duplicates.
    const existing = await prisma.screeningRecord.findFirst({ where: { userId, screeningId, doneOn: asDate(doneOn) } });
    if (!existing) await prisma.screeningRecord.create({ data: { userId, screeningId, doneOn: asDate(doneOn) } });
  },

  async removeRecord(userId: string, screeningId: string, recordId: string) {
    const rec = await prisma.screeningRecord.findUnique({ where: { id: recordId } });
    if (!rec || rec.screeningId !== screeningId) throw new NotFoundError("Record not found.");
    if (rec.userId !== userId) throw new ForbiddenError();
    await prisma.screeningRecord.delete({ where: { id: recordId } });
  },
};
