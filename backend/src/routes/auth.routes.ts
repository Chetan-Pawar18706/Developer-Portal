import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import {
  forgotPasswordRateLimiter,
  loginRateLimiter,
  refreshRateLimiter,
  registerRateLimiter,
  resetPasswordRateLimiter,
} from '../middleware/rateLimit';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from './auth.schemas';

export const authRouter = Router();

authRouter.post(
  '/register',
  registerRateLimiter,
  validate({ body: registerSchema }),
  asyncHandler(authController.register),
);

authRouter.post(
  '/login',
  loginRateLimiter,
  validate({ body: loginSchema }),
  asyncHandler(authController.login),
);

authRouter.post('/refresh', refreshRateLimiter, asyncHandler(authController.refresh));

authRouter.post('/logout', refreshRateLimiter, asyncHandler(authController.logout));

authRouter.post(
  '/forgot-password',
  forgotPasswordRateLimiter,
  validate({ body: forgotPasswordSchema }),
  asyncHandler(authController.forgotPassword),
);

authRouter.post(
  '/reset-password',
  resetPasswordRateLimiter,
  validate({ body: resetPasswordSchema }),
  asyncHandler(authController.resetPassword),
);

authRouter.get('/me', authenticate, asyncHandler(authController.me));

authRouter.patch(
  '/profile',
  authenticate,
  validate({ body: updateProfileSchema }),
  asyncHandler(authController.updateProfile),
);
