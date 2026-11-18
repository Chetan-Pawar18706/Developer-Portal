import { randomBytes } from 'node:crypto';
import { env } from '../config/env';
import {
  User,
  hashPassword,
  type NotificationPreferences,
  type UserDocument,
  type UserRole,
  type UserTheme,
} from '../models/user.model';
import { ApiError } from '../utils/ApiError';
import { hashToken, signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/token';
import { sendPasswordResetEmail } from './mail.service';

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string | null;
  isActive: boolean;
  notificationPrefs: {
    emailOnAssignment: boolean;
    emailOnMention: boolean;
    emailOnStatusChange: boolean;
    emailOnReminder: boolean;
  };
  theme: UserTheme;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface UpdateProfileInput {
  name?: string;
  notificationPrefs?: Partial<NotificationPreferences>;
  theme?: UserTheme;
}

export function toPublicUser(user: UserDocument): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
    isActive: user.isActive,
    notificationPrefs: {
      emailOnAssignment: user.notificationPrefs.emailOnAssignment,
      emailOnMention: user.notificationPrefs.emailOnMention,
      emailOnStatusChange: user.notificationPrefs.emailOnStatusChange,
      emailOnReminder: user.notificationPrefs.emailOnReminder,
    },
    theme: user.theme,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

async function issueTokens(
  user: UserDocument,
): Promise<{ accessToken: string; refreshToken: string }> {
  const accessToken = signAccessToken(user.id, user.role);
  const refreshToken = signRefreshToken(user.id, user.role);

  user.refreshTokenHash = hashToken(refreshToken);
  await user.save();

  return { accessToken, refreshToken };
}

export async function registerUser(input: RegisterInput): Promise<AuthResult> {
  const existingUser = await User.exists({ email: input.email });

  if (existingUser) {
    throw new ApiError(409, 'Email is already registered');
  }

  const passwordHash = await hashPassword(input.password);
  const user = await User.create({
    name: input.name,
    email: input.email,
    passwordHash,
    role: 'client',
  });

  const tokens = await issueTokens(user);

  return { user: toPublicUser(user), ...tokens };
}

export async function loginUser(input: LoginInput): Promise<AuthResult> {
  const user = await User.findOne({ email: input.email }).select('+passwordHash');

  if (!user) {
    throw new ApiError(401, 'Invalid email or password');
  }

  if (!user.isActive) {
    throw new ApiError(403, 'Account is deactivated');
  }

  const passwordMatches = await user.comparePassword(input.password);

  if (!passwordMatches) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const tokens = await issueTokens(user);

  return { user: toPublicUser(user), ...tokens };
}

export async function refreshSession(refreshToken: string | undefined): Promise<AuthResult> {
  if (!refreshToken) {
    throw new ApiError(401, 'Refresh token is missing');
  }

  let payload;

  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new ApiError(401, 'Invalid or expired refresh token');
  }

  if (payload.type !== 'refresh') {
    throw new ApiError(401, 'Invalid refresh token');
  }

  const user = await User.findById(payload.sub).select('+refreshTokenHash');

  if (!user || !user.isActive) {
    throw new ApiError(401, 'Invalid refresh token');
  }

  if (!user.refreshTokenHash || user.refreshTokenHash !== hashToken(refreshToken)) {
    throw new ApiError(401, 'Invalid refresh token');
  }

  const tokens = await issueTokens(user);

  return { user: toPublicUser(user), ...tokens };
}

export async function logoutUser(refreshToken: string | undefined): Promise<void> {
  if (!refreshToken) {
    return;
  }

  try {
    const payload = verifyRefreshToken(refreshToken);
    await User.findByIdAndUpdate(payload.sub, { $set: { refreshTokenHash: null } });
  } catch {
    // Logout is idempotent; an invalid or expired token still clears the cookie.
  }
}

export async function requestPasswordReset(email: string): Promise<void> {
  const user = await User.findOne({ email, isActive: true }).select('+resetTokenHash');

  if (!user) {
    return;
  }

  const token = randomBytes(32).toString('hex');
  user.resetTokenHash = hashToken(token);
  user.resetTokenExpires = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
  await user.save();

  const resetUrl = `${env.CLIENT_URL}/reset-password?token=${token}`;

  if (env.NODE_ENV !== 'test') {
    console.log(`Password reset link for ${user.email}: ${resetUrl}`);
  }

  try {
    await sendPasswordResetEmail(user.email, resetUrl);
  } catch (error) {
    console.error('Failed to send password reset email:', error);
  }
}

export async function resetPassword(token: string, password: string): Promise<void> {
  const user = await User.findOne({
    resetTokenHash: hashToken(token),
    resetTokenExpires: { $gt: new Date() },
  });

  if (!user) {
    throw new ApiError(400, 'Invalid or expired password reset token');
  }

  user.passwordHash = await hashPassword(password);
  user.resetTokenHash = null;
  user.resetTokenExpires = null;
  user.refreshTokenHash = null;
  await user.save();
}

export async function getCurrentUser(userId: string): Promise<PublicUser> {
  const user = await User.findById(userId);

  if (!user || !user.isActive) {
    throw new ApiError(404, 'User not found');
  }

  return toPublicUser(user);
}

export async function updateProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<PublicUser> {
  const user = await User.findById(userId);

  if (!user || !user.isActive) {
    throw new ApiError(404, 'User not found');
  }

  if (input.name !== undefined) {
    user.name = input.name;
  }

  if (input.notificationPrefs) {
    user.notificationPrefs = {
      ...user.notificationPrefs,
      ...input.notificationPrefs,
    };
  }

  if (input.theme !== undefined) {
    user.theme = input.theme;
  }

  await user.save();
  return toPublicUser(user);
}
