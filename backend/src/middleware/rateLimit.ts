import type { Request } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { env } from '../config/env';

type LimitScope = 'ip' | 'user';

interface RateLimitInput {
  limit: number;
  message: string;
  scope?: LimitScope;
}

function buildOptions({ limit, message, scope = 'ip' }: RateLimitInput) {
  return {
    windowMs: 15 * 60 * 1000,
    limit: env.NODE_ENV === 'test' ? 10000 : limit,
    standardHeaders: 'draft-8' as const,
    legacyHeaders: false,
    message: {
      success: false,
      data: null,
      message,
    },
    keyGenerator: (req: Request): string => {
      if (scope === 'user' && req.user?.id) {
        return `user:${req.user.id}`;
      }

      return `ip:${ipKeyGenerator(req.ip ?? '')}`;
    },
  };
}

export const apiRateLimiter = rateLimit(
  buildOptions({ limit: 1000, message: 'Too many requests, please try again later' }),
);

export const registerRateLimiter = rateLimit(
  buildOptions({ limit: 20, message: 'Too many registration attempts, please try again later' }),
);

export const loginRateLimiter = rateLimit(
  buildOptions({ limit: 20, message: 'Too many authentication attempts, please try again later' }),
);

export const forgotPasswordRateLimiter = rateLimit(
  buildOptions({ limit: 10, message: 'Too many password reset requests, please try again later' }),
);

export const resetPasswordRateLimiter = rateLimit(
  buildOptions({ limit: 20, message: 'Too many password reset attempts, please try again later' }),
);

export const refreshRateLimiter = rateLimit(
  buildOptions({ limit: 60, message: 'Too many token refresh attempts, please try again later' }),
);

export const uploadRateLimiter = rateLimit(
  buildOptions({
    limit: 60,
    message: 'Too many file uploads, please try again later',
    scope: 'user',
  }),
);

export const searchRateLimiter = rateLimit(
  buildOptions({
    limit: 120,
    message: 'Too many search requests, please try again later',
    scope: 'user',
  }),
);
