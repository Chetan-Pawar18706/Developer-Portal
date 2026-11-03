import type { RequestHandler } from 'express';
import { verifyAccessToken } from '../utils/token';
import { ApiError } from '../utils/ApiError';

const BEARER_PREFIX = 'Bearer ';

export const authenticate: RequestHandler = (req, _res, next) => {
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

    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch (error) {
    next(
      error instanceof ApiError
        ? error
        : new ApiError(401, 'Invalid or expired access token'),
    );
  }
};
