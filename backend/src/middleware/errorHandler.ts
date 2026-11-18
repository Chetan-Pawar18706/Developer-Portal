import type { ErrorRequestHandler } from 'express';
import multer from 'multer';
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

  if (error instanceof multer.MulterError) {
    const message =
      error.code === 'LIMIT_FILE_SIZE'
        ? 'Files must be 25 MB or smaller'
        : error.code === 'LIMIT_FILE_COUNT'
          ? 'You can upload at most 20 files at once'
          : 'Upload failed';

    res.status(400).json({ success: false, data: null, message, details: [] });
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
