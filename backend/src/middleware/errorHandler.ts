import type { ErrorRequestHandler } from 'express';
import { env } from '../config/env';

interface HttpError extends Error {
  statusCode?: number;
}

export const errorHandler: ErrorRequestHandler = (error: HttpError, _req, res, _next) => {
  const statusCode = error.statusCode ?? 500;

  if (env.NODE_ENV !== 'test') {
    console.error(error);
  }

  res.status(statusCode).json({
    success: false,
    data: null,
    message: statusCode >= 500 ? 'Internal server error' : error.message,
  });
};
