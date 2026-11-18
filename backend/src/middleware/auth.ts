import type { RequestHandler } from 'express';
import { User } from '../models/user.model';
import { ApiError } from '../utils/ApiError';
import { verifyAccessToken } from '../utils/token';

const BEARER_PREFIX = 'Bearer ';

export const authenticate: RequestHandler = async (req, _res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith(BEARER_PREFIX)) {
    next(new ApiError(401, 'Authentication required'));
    return;
  }

  const token = authorization.slice(BEARER_PREFIX.length).trim();

  try {
    const payload = verifyAccessToken(token);

    if (payload.type !== 'access') {
      next(new ApiError(401, 'Invalid access token'));
      return;
    }

    const user = await User.findById(payload.sub).select('role isActive').lean();

    if (!user || !user.isActive) {
      next(new ApiError(401, 'Account is inactive or no longer exists'));
      return;
    }

    req.user = { id: payload.sub, role: user.role };
    next();
  } catch (error) {
    next(
      error instanceof ApiError
        ? error
        : new ApiError(401, 'Invalid or expired access token'),
    );
  }
};
