import type { ErrorRequestHandler } from 'express';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 11000
  );
}

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (error instanceof ApiError) {
    res.status(error.statusCode).json({
      success: false,
      data: null,
      message: error.message,
      details: error.details,
    });
    return;
  }

  if (isDuplicateKeyError(error)) {
    res.status(409).json({
      success: false,
      data: null,
      message: 'A record with that value already exists',
      details: [],
    });
    return;
  }

  if (env.NODE_ENV !== 'test') {
    console.error(error);
  }

  res.status(500).json({
    success: false,
    data: null,
    message: 'Internal server error',
    details: [],
  });
};
