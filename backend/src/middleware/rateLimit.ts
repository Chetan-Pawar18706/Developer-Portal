import { rateLimit } from 'express-rate-limit';

const rateLimiterOptions = {
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8' as const,
  legacyHeaders: false,
  message: {
    success: false,
    data: null,
    message: 'Too many authentication attempts, please try again later',
  },
};

export const registerRateLimiter = rateLimit(rateLimiterOptions);
export const loginRateLimiter = rateLimit(rateLimiterOptions);
export const forgotPasswordRateLimiter = rateLimit(rateLimiterOptions);
