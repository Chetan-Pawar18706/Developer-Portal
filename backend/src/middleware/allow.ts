import type { RequestHandler } from 'express';
import type { UserRole } from '../models/user.model';
import { ApiError } from '../utils/ApiError';

export function allow(...roles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      next(new ApiError(401, 'Authentication required'));
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(new ApiError(403, 'You do not have permission to perform this action'));
      return;
    }

    next();
  };
}
