import { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodTypeAny, z } from 'zod';
import { AppError } from '../lib/errors';

function parse<S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new AppError('VALIDATION_ERROR', 400, 'Request validation failed', {
      issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  return result.data;
}

/** Validates req.body and replaces it with the parsed value. */
export function validateBody(schema: ZodTypeAny): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.body = parse(schema, req.body ?? {});
    next();
  };
}

/** Validates req.query; the parsed value is read with getQuery(res). (Express 5 req.query is read-only.) */
export function validateQuery(schema: ZodTypeAny): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    res.locals['query'] = parse(schema, req.query);
    next();
  };
}

export function getQuery<T>(res: Response): T {
  return res.locals['query'] as T;
}

const uuidParam = z.string().uuid();

/** Parses a UUID route param, returning NOT_FOUND-style validation error otherwise. */
export function uuidParamOf(value: unknown): string {
  return parse(uuidParam, value);
}
