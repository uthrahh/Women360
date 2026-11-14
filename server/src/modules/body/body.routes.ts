import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "@/lib/asyncHandler";
import { validate } from "@/middleware/validate";
import { requireAuth } from "@/middleware/auth";
import { created, noContent, ok } from "@/lib/response";
import { assertPlausibleDay } from "@/lib/days";
import { NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

/**
 * Caffeine, alcohol and bowel movements: one tap logs one. These came up again and again in what women say tracking apps miss
 * (caffeine and alcohol for sleep and mood; bowel movements for IBS and the gut changes many notice across the cycle). They are
 * counts on her own day, nothing more: no targets, no judgement, no score.
 */
export const BODY_KINDS = ["caffeine", "alcohol", "bowel"] as const;
export const BOWEL_DETAILS = ["hard", "normal", "loose"] as const;

export const bodyRouter = Router();
bodyRouter.use(requireAuth);

const day = z.string().date();
const asDate = (d: string) => new Date(`${d}T00:00:00.000Z`);

/** Everything logged on one day, oldest first. */
bodyRouter.get(
  "/",
  validate({ query: z.object({ date: day }) }),
  asyncHandler(async (req, res) => {
    const date = (req.query as { date: string }).date;
    const rows = await prisma.bodyLog.findMany({ where: { userId: req.user!.id, date: asDate(date) }, orderBy: { loggedAt: "asc" } });
    return ok(res, rows.map((r) => ({ id: r.id, kind: r.kind, detail: r.detail, loggedAt: r.loggedAt })));
  })
);

const logSchema = z
  .object({ date: day, kind: z.enum(BODY_KINDS), detail: z.enum(BOWEL_DETAILS).optional() })
  .refine((v) => v.kind === "bowel" || v.detail === undefined, { message: "Only a bowel movement has a consistency.", path: ["detail"] });

bodyRouter.post(
  "/",
  validate({ body: logSchema }),
  asyncHandler(async (req, res) => {
    const { date, kind, detail } = req.body as z.infer<typeof logSchema>;
    assertPlausibleDay(date);
    const row = await prisma.bodyLog.create({ data: { userId: req.user!.id, date: asDate(date), kind, detail: detail ?? null } });
    return created(res, { id: row.id, kind: row.kind, detail: row.detail, loggedAt: row.loggedAt });
  })
);

/** Undo: removes one of her own entries. */
bodyRouter.delete(
  "/:id",
  validate({ params: z.object({ id: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    const { count } = await prisma.bodyLog.deleteMany({ where: { id: req.params.id, userId: req.user!.id } });
    if (count === 0) throw new NotFoundError("That entry wasn't found.");
    return noContent(res);
  })
);
