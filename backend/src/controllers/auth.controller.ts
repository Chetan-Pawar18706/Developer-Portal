import type { Request, Response } from 'express';
import * as authService from '../services/auth.service';
import type {
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  UpdateProfileInput,
} from '../routes/auth.schemas';
import { ApiError } from '../utils/ApiError';
import {
  clearRefreshCookie,
  REFRESH_COOKIE_NAME,
  readRefreshCookie,
  refreshCookieOptions,
} from '../utils/cookies';
import { sendSuccess } from '../utils/response';

export async function register(req: Request, res: Response): Promise<void> {
  const result = await authService.registerUser(req.body as RegisterInput);

  res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, refreshCookieOptions);
  sendSuccess(
    res,
    { user: result.user, accessToken: result.accessToken },
    'Registration successful',
    201,
  );
}

export async function login(req: Request, res: Response): Promise<void> {
  const result = await authService.loginUser(req.body as LoginInput);

  res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, refreshCookieOptions);
  sendSuccess(res, { user: result.user, accessToken: result.accessToken }, 'Login successful');
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const result = await authService.refreshSession(readRefreshCookie(req));

  res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, refreshCookieOptions);
  sendSuccess(res, { user: result.user, accessToken: result.accessToken }, 'Session refreshed');
}

export async function logout(req: Request, res: Response): Promise<void> {
  await authService.logoutUser(readRefreshCookie(req));

  clearRefreshCookie(res);
  sendSuccess(res, null, 'Logged out successfully');
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const { email } = req.body as ForgotPasswordInput;

  await authService.requestPasswordReset(email);
  sendSuccess(
    res,
    null,
    'If that email is registered, a password reset link has been sent',
  );
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const { token, password } = req.body as ResetPasswordInput;

  await authService.resetPassword(token, password);
  sendSuccess(res, null, 'Password reset successful');
}

export async function me(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }

  const user = await authService.getCurrentUser(req.user.id);
  sendSuccess(res, { user });
}

export async function updateProfile(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }

  const user = await authService.updateProfile(
    req.user.id,
    req.body as UpdateProfileInput,
  );
  sendSuccess(res, { user }, 'Profile updated');
}
