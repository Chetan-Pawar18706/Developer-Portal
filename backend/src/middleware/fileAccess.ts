import type { RequestHandler } from 'express';
import { requireReadableFile } from '../services/file.service';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

export const fileAccess: RequestHandler = asyncHandler(async (req, _res, next) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }

  req.fileRecord = await requireReadableFile(req.params.id, req.user);
  next();
});
