import type { NextFunction, Request, Response } from "express";
import { flattenError, type ZodTypeAny } from "zod";
import { ValidationError } from "@/lib/errors";

interface Schemas {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
}

// Validates and REPLACES req.body/params/query with the parsed (and
// coerced/defaulted) result, so downstream handlers only ever see
// already-validated data.
export function validate(schemas: Schemas) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) return next(new ValidationError(flattenError(result.error)));
      req.body = result.data;
    }
    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) return next(new ValidationError(flattenError(result.error)));
      req.params = result.data as Request["params"];
    }
    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) return next(new ValidationError(flattenError(result.error)));
      req.query = result.data as Request["query"];
    }
    return next();
  };
}
