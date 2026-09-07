import type { Request, Response } from "express";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    ok: false,
    error: { code: "NOT_FOUND", message: `No route matches ${req.method} ${req.path}.` },
  });
}
