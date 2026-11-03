import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { ApiError } from '../utils/ApiError';

type RequestPart = 'body' | 'query' | 'params';

export type ValidationSchemas = Partial<Record<RequestPart, ZodType>>;

const REQUEST_PARTS: RequestPart[] = ['body', 'query', 'params'];

export function validate(schemas: ValidationSchemas): RequestHandler {
  return (req, _res, next) => {
    for (const part of REQUEST_PARTS) {
      const schema = schemas[part];

      if (!schema) {
        continue;
      }

      const result = schema.safeParse(req[part]);

      if (!result.success) {
        const details = result.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));

        next(new ApiError(422, 'Validation failed', details));
        return;
      }

      (req as unknown as Record<RequestPart, unknown>)[part] = result.data;
    }

    next();
  };
}
