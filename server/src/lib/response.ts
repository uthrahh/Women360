import type { Response } from "express";

// A single, consistent envelope for every endpoint in the API — never a
// bare array or a bare object, so clients can rely on one shape.
export function ok<T>(res: Response, data: T, status = 200) {
  return res.status(status).json({ ok: true, data });
}

export function created<T>(res: Response, data: T) {
  return ok(res, data, 201);
}

export function noContent(res: Response) {
  return res.status(204).send();
}

export function paginated<T>(
  res: Response,
  items: T[],
  meta: { page: number; pageSize: number; total: number }
) {
  return res.status(200).json({ ok: true, data: items, meta });
}
