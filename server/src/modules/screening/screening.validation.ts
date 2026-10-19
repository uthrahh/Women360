import { z } from "zod";
import { isValidIsoDay } from "@/lib/streak";
import { SCREENINGS } from "./guidelines";

const isoDay = z.string().refine(isValidIsoDay, "Use a date in YYYY-MM-DD format.");

const ids = SCREENINGS.map((s) => s.id) as [string, ...string[]];

export const screeningQuerySchema = z.object({ today: isoDay.optional() });
export const screeningIdSchema = z.object({ id: z.enum(ids) });
export const screeningRecordIdSchema = z.object({ id: z.enum(ids), recordId: z.string().min(1) });
export const recordBodySchema = z.object({ doneOn: isoDay });
