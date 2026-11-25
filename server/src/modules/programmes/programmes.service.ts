import type { EnrolmentStatus, Prisma, ProgrammeTask, Role, TaskEvent } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";
import { COMPARABLE, SCHEMA_VERSION, checkAnswers, questionsFor, type Kind } from "./questions";
import { dateOfDay, dayNumber, isDue, progressOf, stateOf, weekdayOf, type DayState } from "./schedule";

/** The enrolment statuses in which she is "in" a programme and her coach may work with her. */
const CURRENT: EnrolmentStatus[] = ["ASSESSING", "WAITING_FOR_COACH", "PLANNING", "ACTIVE", "FINAL_ASSESSMENT", "FINAL_REVIEW"];
/** How many days back she may still report a task, so a missed evening is not lost. */
export const RECOVERY_DAYS = 2;

const iso = (d: Date) => d.toISOString().slice(0, 10);
const asDate = (s: string) => new Date(s + "T00:00:00Z");

async function notify(userId: string, title: string, detail: string) {
  await prisma.notification.create({ data: { userId, title, detail } });
}

function eventsIndex(events: Pick<TaskEvent, "taskId" | "date" | "type" | "value" | "note" | "createdAt">[]) {
  const map = new Map<string, typeof events>();
  for (const e of events) {
    const k = e.taskId + "|" + iso(e.date);
    map.set(k, [...(map.get(k) ?? []), e]);
  }
  return map;
}

/** The published tasks as they stand, for the plan-version record. */
function snapshotOf(tasks: ProgrammeTask[]) {
  return tasks
    .filter((t) => t.published && t.status === "ACTIVE")
    .map((t) => ({ title: t.title, category: t.category, kind: t.kind, unit: t.unit, target: t.target, frequency: t.frequency, weekdays: t.weekdays, startDay: t.startDay, endDay: t.endDay }));
}

const taskView = (t: ProgrammeTask) => ({
  id: t.id,
  title: t.title,
  category: t.category,
  kind: t.kind,
  unit: t.unit,
  target: t.target,
  instructions: t.instructions,
  safetyNotes: t.safetyNotes,
  frequency: t.frequency,
  weekdays: t.weekdays,
  startDay: t.startDay,
  endDay: t.endDay,
  status: t.status,
  published: t.published,
  endedOnDay: t.endedOnDay,
  fromTemplate: t.templateId !== null,
});

/** Baseline and final answers side by side, for the questions asked both times. */
function comparisonOf(baseline: Prisma.JsonValue | undefined, final: Prisma.JsonValue | undefined) {
  if (!baseline || !final) return null;
  const b = baseline as Record<string, unknown>;
  const f = final as Record<string, unknown>;
  return COMPARABLE.map((id) => ({ id, before: b[id] ?? null, after: f[id] ?? null }));
}

// ---------------------------------------------------------------------------------------------------------------------
// The woman
// ---------------------------------------------------------------------------------------------------------------------

async function myCurrent(userId: string) {
  return prisma.enrolment.findFirst({ where: { userId, status: { in: CURRENT } }, orderBy: { createdAt: "desc" } });
}

export const programmesService = {
  questions(kind: Kind) {
    return { schemaVersion: SCHEMA_VERSION, questions: questionsFor(kind) };
  },

  /** Programmes open to her: published ones, and only the sample ones on a demonstration account. */
  async available(isDemo: boolean) {
    return prisma.programme.findMany({
      where: { status: "PUBLISHED", demoOnly: isDemo },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, summary: true, durationDays: true },
    });
  },

  async join(userId: string, isDemo: boolean, programmeId: string) {
    const programme = await prisma.programme.findFirst({ where: { id: programmeId, status: "PUBLISHED", demoOnly: isDemo } });
    if (!programme) throw new NotFoundError("That programme isn't open to join.");
    if (await myCurrent(userId)) throw new ConflictError("You're already in a programme. Finish or leave it first.");
    const e = await prisma.enrolment.create({ data: { programmeId, userId, consentAt: new Date() } });
    await recordAudit({ actorId: userId, actorRole: "WOMAN", action: "programme.joined", targetType: "Enrolment", targetId: e.id });
    return { id: e.id };
  },

  /**
   * Everything her programme screen needs for her own day. Day 1 is set the first time she opens a published plan,
   * and once the last day has passed the programme moves to the final questions.
   */
  async mine(userId: string, isDemo: boolean, today: string) {
    let e = await myCurrent(userId);
    if (e?.status === "ACTIVE" && !e.startDate) e = await prisma.enrolment.update({ where: { id: e.id }, data: { startDate: asDate(today) } });
    const last = e ? null : await prisma.enrolment.findFirst({ where: { userId, status: "COMPLETED" }, orderBy: { endedAt: "desc" } });
    const target = e ?? last;
    if (!target) return { current: null, available: await this.available(isDemo) };

    const full = await prisma.enrolment.findUniqueOrThrow({
      where: { id: target.id },
      include: {
        programme: { select: { name: true, summary: true, durationDays: true } },
        coach: { select: { name: true } },
        assessments: true,
        tasks: { where: { published: true }, orderBy: { createdAt: "asc" } },
        planVersions: { orderBy: { version: "desc" }, take: 5, select: { version: true, reason: true, createdAt: true } },
        reviews: { orderBy: { createdAt: "desc" }, select: { kind: true, notes: true, createdAt: true } },
      },
    });
    const start = full.startDate ? iso(full.startDate) : null;
    let day = start ? dayNumber(start, today) : null;
    let status = full.status;
    if (status === "ACTIVE" && day !== null && day > full.programme.durationDays) {
      status = "FINAL_ASSESSMENT";
      await prisma.enrolment.update({ where: { id: full.id }, data: { status } });
    }
    if (day !== null) day = Math.min(day, full.programme.durationDays);

    const baseline = full.assessments.find((a) => a.kind === "BASELINE");
    const final = full.assessments.find((a) => a.kind === "FINAL");

    // Today, plus the recovery days she can still report, for the tasks that were due on them.
    let days: { date: string; day: number; tasks: (ReturnType<typeof taskView> & { state: DayState })[] }[] = [];
    let progress = null;
    if (start && full.tasks.length > 0 && day !== null && day >= 1) {
      const events = await prisma.taskEvent.findMany({ where: { taskId: { in: full.tasks.map((t) => t.id) } } });
      const index = eventsIndex(events);
      const lastDay = Math.min(dayNumber(start, today), full.programme.durationDays);
      for (let d = lastDay; d >= Math.max(1, lastDay - RECOVERY_DAYS); d--) {
        const date = dateOfDay(start, d);
        if (date > today) continue;
        const due = full.tasks.filter((t) => isDue(t, d, weekdayOf(date)));
        const tasks = due.map((t) => ({ ...taskView(t), state: stateOf(index.get(t.id + "|" + date) ?? []) }));
        // Earlier days are shown only for what is still open on them, or waiting for (or answered by) her coach.
        const shown = d === lastDay ? tasks : tasks.filter((t) => t.state.status === "open" || t.state.status === "help" || t.state.replies.length > 0);
        if (shown.length > 0 || d === lastDay) days.push({ date, day: d, tasks: shown });
      }
      progress = progressOf(full.tasks, index, start, lastDay);
      if (status !== "ACTIVE") days = [];
    }

    return {
      current: {
        id: full.id,
        status,
        programme: full.programme,
        coach: full.coach ? { name: full.coach.name } : null,
        startDate: start,
        day,
        nextReviewOn: full.nextReviewOn ? iso(full.nextReviewOn) : null,
        baseline: baseline ? { answers: baseline.answers, submittedAt: baseline.submittedAt } : null,
        final: final ? { answers: final.answers, submittedAt: final.submittedAt } : null,
        days,
        progress,
        changes: full.planVersions.map((v) => ({ version: v.version, reason: v.reason, at: v.createdAt })),
        reviews: full.reviews.map((r) => ({ kind: r.kind, notes: r.notes, at: r.createdAt })),
        comparison: status === "COMPLETED" ? comparisonOf(baseline?.answers, final?.answers) : null,
      },
      available: status === "COMPLETED" ? await this.available(isDemo) : [],
    };
  },

  /** Saves her answers as a draft, or submits them. A submitted questionnaire can't be changed. */
  async saveAssessment(userId: string, kind: Kind, answers: Record<string, unknown>, submit: boolean) {
    const e = await myCurrent(userId);
    if (!e) throw new NotFoundError("You're not in a programme.");
    const expected: EnrolmentStatus = kind === "BASELINE" ? "ASSESSING" : "FINAL_ASSESSMENT";
    if (e.status !== expected) throw new ConflictError("These questions aren't open right now.");
    const checked = checkAnswers(kind, answers, submit);
    if (!checked.ok) throw new BadRequestError(checked.error);
    const data = { answers: checked.answers as Prisma.InputJsonValue, schemaVersion: SCHEMA_VERSION, submittedAt: submit ? new Date() : null };
    await prisma.assessment.upsert({ where: { enrolmentId_kind: { enrolmentId: e.id, kind } }, create: { enrolmentId: e.id, kind, ...data }, update: data });
    if (!submit) return { saved: true, status: e.status };

    const next: EnrolmentStatus = kind === "FINAL" ? "FINAL_REVIEW" : e.coachId ? "PLANNING" : "WAITING_FOR_COACH";
    await prisma.enrolment.update({ where: { id: e.id }, data: { status: next } });
    if (e.coachId) {
      await notify(
        e.coachId,
        kind === "FINAL" ? "Final answers are in" : "New answers to plan from",
        kind === "FINAL" ? "Someone you coach has finished her programme and is waiting for your final review." : "Someone you coach has answered her starting questions and is waiting for her plan."
      );
    }
    return { saved: true, status: next };
  },

  /** She reports what happened with a task on one of her days: today or one of the recovery days before it. */
  async logTask(userId: string, taskId: string, input: { date: string; type: "DONE" | "SKIPPED" | "NEED_HELP" | "UNDONE"; value?: number | null; note?: string | null }, today: string) {
    const task = await prisma.programmeTask.findUnique({ where: { id: taskId }, include: { enrolment: { include: { programme: true } } } });
    if (!task || task.enrolment.userId !== userId) throw new NotFoundError("We couldn't find that task.");
    const e = task.enrolment;
    if (e.status !== "ACTIVE" || !e.startDate) throw new ConflictError("This programme isn't running right now.");
    if (input.date > today) throw new BadRequestError("That day hasn't happened yet.");
    const day = dayNumber(iso(e.startDate), input.date);
    const todayDay = dayNumber(iso(e.startDate), today);
    if (todayDay - day > RECOVERY_DAYS) throw new BadRequestError(`You can report a task for today and the ${RECOVERY_DAYS} days before it.`);
    if (day < 1 || day > e.programme.durationDays || !isDue(task, day, weekdayOf(input.date))) throw new BadRequestError("That task isn't due on that day.");
    if (input.type === "DONE" && task.kind === "AMOUNT" && (input.value === undefined || input.value === null)) throw new BadRequestError("Enter the amount.");

    const existing = await prisma.taskEvent.findMany({ where: { taskId, date: asDate(input.date) } });
    const now = stateOf(existing);
    const wanted = { DONE: "done", SKIPPED: "skipped", NEED_HELP: "help", UNDONE: "open" }[input.type];
    // The same report twice (a double tap, a retried request) is not a second event.
    const same = now.status === wanted && (input.type !== "DONE" || now.value === (input.value ?? null)) && (input.type === "UNDONE" || now.note === (input.note ?? null));
    if (!same) {
      await prisma.taskEvent.create({
        data: { taskId, date: asDate(input.date), type: input.type, value: input.type === "DONE" ? input.value ?? null : null, note: input.note ?? null, actorId: userId, actorRole: "WOMAN" },
      });
      if (input.type === "NEED_HELP" && e.coachId) {
        await notify(e.coachId, "Someone asked for help", `A task needs your reply: "${task.title}".`);
      }
    }
    return stateOf(await prisma.taskEvent.findMany({ where: { taskId, date: asDate(input.date) } }));
  },

  async leave(userId: string) {
    const e = await myCurrent(userId);
    if (!e) throw new NotFoundError("You're not in a programme.");
    await prisma.enrolment.update({ where: { id: e.id }, data: { status: "LEFT", endedAt: new Date() } });
    await recordAudit({ actorId: userId, actorRole: "WOMAN", action: "programme.left", targetType: "Enrolment", targetId: e.id });
    if (e.coachId) await notify(e.coachId, "Someone left a programme", "A person you were coaching has left her programme. You no longer see her plan.");
    return { left: true };
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// The coach
// ---------------------------------------------------------------------------------------------------------------------

/** A coach sees an enrolment only while she is assigned to it and the woman is still in the programme. */
async function coachEnrolment(coachId: string, enrolmentId: string) {
  const e = await prisma.enrolment.findUnique({ where: { id: enrolmentId }, include: { programme: true, user: { select: { id: true, name: true, isDemo: true } } } });
  if (!e || e.coachId !== coachId || !CURRENT.includes(e.status)) {
    await recordAudit({ actorId: coachId, actorRole: "COACH", action: "security.programme_access_denied", targetType: "Enrolment", targetId: enrolmentId });
    throw new ForbiddenError("You aren't assigned to this person's programme.");
  }
  return e;
}

async function coachTask(coachId: string, taskId: string) {
  const t = await prisma.programmeTask.findUnique({ where: { id: taskId } });
  if (!t) throw new NotFoundError("We couldn't find that task.");
  const e = await coachEnrolment(coachId, t.enrolmentId);
  return { t, e };
}

export interface TaskInput {
  templateId?: string | null;
  title: string;
  category: ProgrammeTask["category"];
  kind: ProgrammeTask["kind"];
  unit?: string | null;
  target?: number | null;
  instructions: string;
  safetyNotes?: string | null;
  frequency: ProgrammeTask["frequency"];
  weekdays?: number[];
  startDay: number;
  endDay: number;
}

function checkTask(input: TaskInput, durationDays: number) {
  if (input.endDay > durationDays || input.startDay > durationDays) throw new BadRequestError(`This programme is ${durationDays} days long.`);
  if (input.endDay < input.startDay) throw new BadRequestError("The last day can't be before the first.");
  if (input.frequency === "WEEKDAYS" && !(input.weekdays && input.weekdays.length > 0)) throw new BadRequestError("Choose at least one day of the week.");
  if (input.kind === "AMOUNT" && !input.unit) throw new BadRequestError("An amount task needs a unit, such as glasses or minutes.");
  return {
    title: input.title,
    category: input.category,
    kind: input.kind,
    unit: input.kind === "AMOUNT" ? input.unit ?? null : null,
    target: input.kind === "AMOUNT" ? input.target ?? null : null,
    instructions: input.instructions,
    safetyNotes: input.safetyNotes ?? null,
    frequency: input.frequency,
    weekdays: input.frequency === "WEEKDAYS" ? [...new Set(input.weekdays)].sort() : [],
    startDay: input.startDay,
    endDay: input.frequency === "ONCE" ? input.startDay : input.endDay,
  };
}

/** Today's programme day from the coach's own date, or null before day 1. */
const currentDay = (e: { startDate: Date | null }, today: string) => (e.startDate ? dayNumber(iso(e.startDate), today) : null);

async function newVersion(enrolmentId: string, coachId: string, reason: string) {
  const e = await prisma.enrolment.findUniqueOrThrow({ where: { id: enrolmentId }, include: { tasks: true } });
  const version = e.planVersion + 1;
  await prisma.$transaction([
    prisma.planVersion.create({ data: { enrolmentId, version, reason, snapshot: snapshotOf(e.tasks) as Prisma.InputJsonValue, createdById: coachId } }),
    prisma.enrolment.update({ where: { id: enrolmentId }, data: { planVersion: version } }),
  ]);
  return version;
}

export const coachProgrammeService = {
  async caseload(coachId: string, today: string) {
    const list = await prisma.enrolment.findMany({
      where: { coachId, status: { in: CURRENT } },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { name: true } }, programme: { select: { name: true, durationDays: true } }, tasks: { select: { id: true } } },
    });
    const taskIds = list.flatMap((e) => e.tasks.map((t) => t.id));
    const events = taskIds.length ? await prisma.taskEvent.findMany({ where: { taskId: { in: taskIds } }, select: { taskId: true, date: true, type: true, value: true, note: true, createdAt: true } }) : [];
    const index = eventsIndex(events);
    return list.map((e) => {
      const mine = new Set(e.tasks.map((t) => t.id));
      let helpOpen = 0;
      let lastActivity: Date | null = null;
      for (const [k, evs] of index) {
        if (!mine.has(k.split("|")[0])) continue;
        if (stateOf(evs).helpOpen) helpOpen++;
        for (const ev of evs) if (ev.type !== "COACH_REPLY" && (!lastActivity || ev.createdAt > lastActivity)) lastActivity = ev.createdAt;
      }
      const day = currentDay(e, today);
      return {
        id: e.id,
        name: e.user.name,
        programme: e.programme.name,
        status: e.status,
        day: day === null ? null : Math.min(day, e.programme.durationDays),
        durationDays: e.programme.durationDays,
        helpOpen,
        lastActivity,
        nextReviewOn: e.nextReviewOn ? iso(e.nextReviewOn) : null,
      };
    });
  },

  /** Approved templates the coach can build this person's plan from (the sample ones only for a demonstration participant). */
  async templatesFor(coachId: string, enrolmentId: string) {
    const e = await coachEnrolment(coachId, enrolmentId);
    return prisma.taskTemplate.findMany({ where: { status: "APPROVED", demoOnly: e.user.isDemo }, orderBy: [{ category: "asc" }, { title: "asc" }] });
  },

  async detail(coachId: string, enrolmentId: string, today: string) {
    const e = await coachEnrolment(coachId, enrolmentId);
    const full = await prisma.enrolment.findUniqueOrThrow({
      where: { id: e.id },
      include: {
        assessments: true,
        tasks: { orderBy: { createdAt: "asc" } },
        planVersions: { orderBy: { version: "desc" }, select: { version: true, reason: true, createdAt: true } },
        reviews: { orderBy: { createdAt: "desc" }, select: { kind: true, notes: true, createdAt: true } },
      },
    });
    const start = full.startDate ? iso(full.startDate) : null;
    const events = full.tasks.length ? await prisma.taskEvent.findMany({ where: { taskId: { in: full.tasks.map((t) => t.id) } }, orderBy: { createdAt: "asc" } }) : [];
    const index = eventsIndex(events);

    // The last 7 days of her published plan, newest first, and every help request still waiting for an answer.
    const recent: { date: string; day: number; items: { taskId: string; title: string; state: DayState }[] }[] = [];
    let progress = null;
    const day = currentDay(full, today);
    if (start && day !== null && day >= 1) {
      const lastDay = Math.min(day, e.programme.durationDays);
      for (let d = lastDay; d >= Math.max(1, lastDay - 6); d--) {
        const date = dateOfDay(start, d);
        const items = full.tasks.filter((t) => isDue(t, d, weekdayOf(date))).map((t) => ({ taskId: t.id, title: t.title, state: stateOf(index.get(t.id + "|" + date) ?? []) }));
        recent.push({ date, day: d, items });
      }
      progress = progressOf(full.tasks, index, start, lastDay);
    }
    const helpRequests = [...index.entries()]
      .filter(([, evs]) => stateOf(evs).helpOpen)
      .map(([k, evs]) => {
        const [taskId, date] = k.split("|");
        const s = stateOf(evs);
        return { taskId, date, title: full.tasks.find((t) => t.id === taskId)?.title ?? "", note: s.note };
      });

    await recordAudit({ actorId: coachId, actorRole: "COACH", action: "programme.enrolment_viewed", targetType: "Enrolment", targetId: e.id });
    const answers = (kind: Kind) => {
      const a = full.assessments.find((x) => x.kind === kind);
      return a && a.submittedAt ? { answers: a.answers, submittedAt: a.submittedAt, schemaVersion: a.schemaVersion } : null;
    };
    return {
      id: e.id,
      name: e.user.name,
      isDemo: e.user.isDemo,
      status: e.status,
      programme: { name: e.programme.name, durationDays: e.programme.durationDays },
      startDate: start,
      day: day === null ? null : Math.min(day, e.programme.durationDays),
      planVersion: full.planVersion,
      nextReviewOn: full.nextReviewOn ? iso(full.nextReviewOn) : null,
      baseline: answers("BASELINE"),
      final: answers("FINAL"),
      tasks: full.tasks.map(taskView),
      recent,
      helpRequests,
      progress,
      changes: full.planVersions.map((v) => ({ version: v.version, reason: v.reason, at: v.createdAt })),
      reviews: full.reviews.map((r) => ({ kind: r.kind, notes: r.notes, at: r.createdAt })),
    };
  },

  /** A new task is a draft until the plan (or the change) is published. From a template, the template's words are copied. */
  async addTask(coachId: string, enrolmentId: string, input: TaskInput) {
    const e = await coachEnrolment(coachId, enrolmentId);
    if (!["PLANNING", "ACTIVE"].includes(e.status)) throw new ConflictError("Tasks can be added once her starting answers are in.");
    if (input.templateId) {
      const tpl = await prisma.taskTemplate.findFirst({ where: { id: input.templateId, status: "APPROVED", demoOnly: e.user.isDemo } });
      if (!tpl) throw new BadRequestError("That template isn't approved for use.");
    }
    const data = checkTask(input, e.programme.durationDays);
    const t = await prisma.programmeTask.create({ data: { ...data, enrolmentId, templateId: input.templateId ?? null, createdById: coachId } });
    return taskView(t);
  },

  /**
   * Changing a draft edits it. Changing a published task never moves its past: the old one ends on the day before today
   * and a new one with the change starts today (or, before her day 1, the task is simply edited). Either way it is a new
   * plan version with the reason, and she is told.
   */
  async changeTask(coachId: string, taskId: string, input: TaskInput & { reason?: string }, today: string) {
    const { t, e } = await coachTask(coachId, taskId);
    const data = checkTask({ ...input, templateId: t.templateId }, e.programme.durationDays);
    if (!t.published) return taskView(await prisma.programmeTask.update({ where: { id: t.id }, data }));
    if (t.status !== "ACTIVE") throw new ConflictError("Resume this task before changing it.");
    if (!input.reason) throw new BadRequestError("Say why you're changing it: she'll see the reason.");
    const day = currentDay(e, today);
    let result: ProgrammeTask;
    if (day === null || day < 1 || day <= t.startDay) {
      result = await prisma.programmeTask.update({ where: { id: t.id }, data });
    } else {
      const startDay = Math.max(data.startDay, day);
      if (startDay > data.endDay) throw new BadRequestError("The last day has already passed.");
      [, result] = await prisma.$transaction([
        prisma.programmeTask.update({ where: { id: t.id }, data: { status: "REPLACED", endedOnDay: day - 1 } }),
        prisma.programmeTask.create({ data: { ...data, startDay, enrolmentId: e.id, templateId: t.templateId, published: true, replacesId: t.id, createdById: coachId } }),
      ]);
    }
    const version = await newVersion(e.id, coachId, input.reason);
    await recordAudit({ actorId: coachId, actorRole: "COACH", action: "programme.task_changed", targetType: "ProgrammeTask", targetId: result.id, metadata: { enrolmentId: e.id, version } });
    await notify(e.userId, "Your plan changed", `Your coach updated "${result.title}": ${input.reason}`);
    return taskView(result);
  },

  async deleteDraft(coachId: string, taskId: string) {
    const { t } = await coachTask(coachId, taskId);
    if (t.published) throw new ConflictError("A published task can be paused or stopped, not deleted: her history with it is kept.");
    await prisma.programmeTask.delete({ where: { id: t.id } });
  },

  /** Pause, resume or stop a published task. Pausing or stopping ends it yesterday; resuming is a new task from today. */
  async setTaskState(coachId: string, taskId: string, action: "pause" | "resume" | "stop", reason: string, today: string) {
    const { t, e } = await coachTask(coachId, taskId);
    if (!t.published) throw new ConflictError("This task isn't published yet.");
    const day = currentDay(e, today);
    const before = day === null || day < 1;
    let result: ProgrammeTask;
    if (action === "resume") {
      if (t.status !== "PAUSED") throw new ConflictError("Only a paused task can be resumed.");
      if (before || t.endedOnDay === null) {
        result = await prisma.programmeTask.update({ where: { id: t.id }, data: { status: "ACTIVE", endedOnDay: null } });
      } else {
        const startDay = Math.max(t.startDay, day!);
        if (startDay > t.endDay) throw new BadRequestError("The last day of this task has already passed.");
        // The paused task stays as the record of its earlier days; a fresh copy carries on from today.
        result = await prisma.programmeTask.create({
          data: { ...checkTask({ ...t, weekdays: t.weekdays }, e.programme.durationDays), startDay, enrolmentId: e.id, templateId: t.templateId, published: true, replacesId: t.id, createdById: coachId },
        });
        await prisma.programmeTask.update({ where: { id: t.id }, data: { status: "REPLACED" } });
      }
    } else {
      if (t.status !== "ACTIVE") throw new ConflictError("This task is already paused or stopped.");
      const endedOnDay = before || day! <= t.startDay ? null : day! - 1;
      result = await prisma.programmeTask.update({ where: { id: t.id }, data: { status: action === "pause" ? "PAUSED" : "STOPPED", endedOnDay } });
    }
    const version = await newVersion(e.id, coachId, reason);
    await recordAudit({ actorId: coachId, actorRole: "COACH", action: `programme.task_${action}d`, targetType: "ProgrammeTask", targetId: result.id, metadata: { enrolmentId: e.id, version } });
    const verb = { pause: "paused", resume: "resumed", stop: "stopped" }[action];
    await notify(e.userId, "Your plan changed", `Your coach ${verb} "${t.title}": ${reason}`);
    return taskView(result);
  },

  /** Publishes every draft task as the next plan version. The first publication starts her programme. */
  async publish(coachId: string, enrolmentId: string, reason: string) {
    const e = await coachEnrolment(coachId, enrolmentId);
    if (!["PLANNING", "ACTIVE"].includes(e.status)) throw new ConflictError("Her starting answers need to be in before a plan can be published.");
    const drafts = await prisma.programmeTask.count({ where: { enrolmentId: e.id, published: false } });
    if (drafts === 0) throw new BadRequestError("Add at least one task first.");
    await prisma.programmeTask.updateMany({ where: { enrolmentId: e.id, published: false }, data: { published: true } });
    if (e.status === "PLANNING") await prisma.enrolment.update({ where: { id: e.id }, data: { status: "ACTIVE" } });
    const version = await newVersion(e.id, coachId, reason);
    await recordAudit({ actorId: coachId, actorRole: "COACH", action: "programme.plan_published", targetType: "Enrolment", targetId: e.id, metadata: { version, tasks: drafts } });
    await notify(e.userId, version === 1 ? "Your plan is ready" : "Your plan changed", version === 1 ? "Your coach has published your plan. Open Programme to see today's tasks." : `Your coach added to your plan: ${reason}`);
    return { version };
  },

  async reply(coachId: string, taskId: string, date: string, note: string) {
    const { t, e } = await coachTask(coachId, taskId);
    const events = await prisma.taskEvent.findMany({ where: { taskId: t.id, date: asDate(date) } });
    if (events.length === 0) throw new BadRequestError("There's nothing from her on that day to reply to.");
    await prisma.taskEvent.create({ data: { taskId: t.id, date: asDate(date), type: "COACH_REPLY", note, actorId: coachId, actorRole: "COACH" } });
    await notify(e.userId, "Your coach replied", `About "${t.title}". Open Programme to read it.`);
    return stateOf(await prisma.taskEvent.findMany({ where: { taskId: t.id, date: asDate(date) } }));
  },

  /** A weekly review keeps the programme going; the final review, once her final answers are in, completes it. */
  async review(coachId: string, enrolmentId: string, input: { kind: "WEEKLY" | "FINAL"; notes: string; nextReviewOn?: string | null }) {
    const e = await coachEnrolment(coachId, enrolmentId);
    if (input.kind === "FINAL" && e.status !== "FINAL_REVIEW") throw new ConflictError("The final review opens once she has answered her final questions.");
    if (input.kind === "WEEKLY" && e.status !== "ACTIVE") throw new ConflictError("Weekly reviews are for a programme that's running.");
    await prisma.programmeReview.create({ data: { enrolmentId: e.id, coachId, kind: input.kind, notes: input.notes } });
    await prisma.enrolment.update({
      where: { id: e.id },
      data: input.kind === "FINAL" ? { status: "COMPLETED", endedAt: new Date(), nextReviewOn: null } : { nextReviewOn: input.nextReviewOn ? asDate(input.nextReviewOn) : null },
    });
    await recordAudit({ actorId: coachId, actorRole: "COACH", action: `programme.review_${input.kind.toLowerCase()}`, targetType: "Enrolment", targetId: e.id });
    await notify(e.userId, input.kind === "FINAL" ? "Your programme is complete" : "Your coach reviewed your week", "Open Programme to read your coach's notes.");
    return { ok: true };
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// The administrator
// ---------------------------------------------------------------------------------------------------------------------

/** The demonstration administrator sees and changes only sample content and demonstration accounts (writes are refused anyway). */
const scope = (isDemo: boolean) => ({ demoOnly: isDemo });

export const adminProgrammeService = {
  async programmes(isDemo: boolean) {
    const list = await prisma.programme.findMany({ where: scope(isDemo), orderBy: { createdAt: "desc" }, include: { _count: { select: { enrolments: true } } } });
    return list.map(({ _count, ...p }) => ({ ...p, enrolments: _count.enrolments }));
  },

  async createProgramme(adminId: string, input: { name: string; summary: string; durationDays: number }) {
    const p = await prisma.programme.create({ data: { ...input, createdById: adminId } });
    await recordAudit({ actorId: adminId, actorRole: "ADMIN", action: "programme.created", targetType: "Programme", targetId: p.id });
    return p;
  },

  async updateProgramme(adminId: string, id: string, input: { name?: string; summary?: string; durationDays?: number; status?: "DRAFT" | "PUBLISHED" | "RETIRED" }) {
    const p = await prisma.programme.findFirst({ where: { id, demoOnly: false }, include: { _count: { select: { enrolments: true } } } });
    if (!p) throw new NotFoundError();
    if (input.durationDays !== undefined && input.durationDays !== p.durationDays && p._count.enrolments > 0) {
      throw new ConflictError("People have joined this programme, so its length can't change. Make a new programme instead.");
    }
    const updated = await prisma.programme.update({ where: { id }, data: input });
    await recordAudit({ actorId: adminId, actorRole: "ADMIN", action: "programme.updated", targetType: "Programme", targetId: id, metadata: { fields: Object.keys(input) } });
    return updated;
  },

  async templates(isDemo: boolean) {
    return prisma.taskTemplate.findMany({ where: scope(isDemo), orderBy: [{ status: "asc" }, { category: "asc" }, { title: "asc" }] });
  },

  async createTemplate(adminId: string, input: Omit<Prisma.TaskTemplateCreateInput, "status" | "reviewedBy" | "reviewedAt" | "demoOnly" | "createdById">) {
    const t = await prisma.taskTemplate.create({ data: { ...input, createdById: adminId } });
    await recordAudit({ actorId: adminId, actorRole: "ADMIN", action: "programme.template_created", targetType: "TaskTemplate", targetId: t.id });
    return t;
  },

  /** Any change to the words sends an approved template back to draft: the approval was for what the reviewer read. */
  async updateTemplate(adminId: string, id: string, input: Partial<Omit<Prisma.TaskTemplateCreateInput, "status" | "reviewedBy" | "reviewedAt" | "demoOnly" | "createdById">> & { status?: "DRAFT" | "RETIRED" }) {
    const t = await prisma.taskTemplate.findFirst({ where: { id, demoOnly: false } });
    if (!t) throw new NotFoundError();
    const { status, ...content } = input;
    const contentChanged = Object.keys(content).length > 0;
    const data: Prisma.TaskTemplateUpdateInput = { ...content };
    if (contentChanged || status === "DRAFT") Object.assign(data, { status: "DRAFT", reviewedBy: null, reviewedAt: null });
    if (status === "RETIRED") data.status = "RETIRED";
    const updated = await prisma.taskTemplate.update({ where: { id }, data });
    await recordAudit({ actorId: adminId, actorRole: "ADMIN", action: "programme.template_updated", targetType: "TaskTemplate", targetId: id, metadata: { fields: Object.keys(input) } });
    return updated;
  },

  async approveTemplate(adminId: string, id: string, reviewedBy: string) {
    const t = await prisma.taskTemplate.findFirst({ where: { id, demoOnly: false } });
    if (!t) throw new NotFoundError();
    if (t.status === "RETIRED") throw new ConflictError("A retired template can't be approved. Make a new one.");
    const updated = await prisma.taskTemplate.update({ where: { id }, data: { status: "APPROVED", reviewedBy, reviewedAt: new Date() } });
    await recordAudit({ actorId: adminId, actorRole: "ADMIN", action: "programme.template_approved", targetType: "TaskTemplate", targetId: id });
    return updated;
  },

  async enrolments(isDemo: boolean) {
    const list = await prisma.enrolment.findMany({
      where: { status: { in: CURRENT }, user: { isDemo } },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { name: true } }, coach: { select: { id: true, name: true } }, programme: { select: { name: true } } },
    });
    return list.map((e) => ({ id: e.id, name: e.user.name, programme: e.programme.name, status: e.status, coach: e.coach, joinedAt: e.createdAt }));
  },

  async coaches(isDemo: boolean) {
    const list = await prisma.user.findMany({
      where: { role: "COACH", deletedAt: null, isDemo },
      orderBy: { name: "asc" },
      select: { id: true, name: true, _count: { select: { coachedEnrolments: { where: { status: { in: CURRENT } } } } } },
    });
    return list.map((c) => ({ id: c.id, name: c.name, caseload: c._count.coachedEnrolments }));
  },

  /** Gives her a coach (or a new one). The earlier coach loses access at once; the change is in the audit log. */
  async assignCoach(adminId: string, adminRole: Role, enrolmentId: string, coachId: string) {
    const e = await prisma.enrolment.findUnique({ where: { id: enrolmentId }, include: { user: { select: { isDemo: true } } } });
    if (!e || !CURRENT.includes(e.status) || e.user.isDemo) throw new NotFoundError();
    const coach = await prisma.user.findFirst({ where: { id: coachId, role: "COACH", deletedAt: null, isDemo: false } });
    if (!coach) throw new BadRequestError("Choose a coach account.");
    const status: EnrolmentStatus = e.status === "WAITING_FOR_COACH" ? "PLANNING" : e.status;
    await prisma.enrolment.update({ where: { id: e.id }, data: { coachId, status } });
    await recordAudit({ actorId: adminId, actorRole: adminRole, action: "programme.coach_assigned", targetType: "Enrolment", targetId: e.id, metadata: { coachId, previousCoachId: e.coachId } });
    await notify(e.userId, "You have a coach", `${coach.name} will guide your programme.`);
    await notify(coachId, "Someone new to coach", "An administrator assigned you a new programme participant.");
    return { ok: true };
  },
};
