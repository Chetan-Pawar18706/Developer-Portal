import type { QueryFilter } from 'mongoose';
import {
  User,
  hashPassword,
  type UserAttributes,
  type UserDocument,
  type UserRole,
} from '../models/user.model';
import { ApiError } from '../utils/ApiError';
import { toPublicUser, type PublicUser } from './auth.service';
import type {
  CreateUserInput,
  ListUsersQuery,
  UpdateProfileInput,
} from '../routes/user.schemas';

export interface UserListResult {
  data: PublicUser[];
  total: number;
  page: number;
  limit: number;
}

export interface UserLookupItem {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string | null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function findUserOrThrow(userId: string): Promise<UserDocument> {
  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  return user;
}

export async function listUsers(query: ListUsersQuery): Promise<UserListResult> {
  const filter: QueryFilter<UserAttributes> = {};

  if (query.search) {
    const searchPattern = new RegExp(escapeRegExp(query.search), 'i');
    filter.$or = [{ name: searchPattern }, { email: searchPattern }];
  }

  if (query.role) {
    filter.role = query.role;
  }

  if (query.isActive !== undefined) {
    filter.isActive = query.isActive;
  }

  const sortDirection = query.sortOrder === 'asc' ? 1 : -1;
  const skip = (query.page - 1) * query.limit;

  const [users, total] = await Promise.all([
    User.find(filter)
      .sort({ [query.sortBy]: sortDirection })
      .skip(skip)
      .limit(query.limit),
    User.countDocuments(filter),
  ]);

  return {
    data: users.map(toPublicUser),
    total,
    page: query.page,
    limit: query.limit,
  };
}

export async function createUserByAdmin(input: CreateUserInput): Promise<PublicUser> {
  const existingUser = await User.exists({ email: input.email });

  if (existingUser) {
    throw new ApiError(409, 'Email is already registered');
  }

  const { password, ...attributes } = input;
  const passwordHash = await hashPassword(password);
  const user = await User.create({ ...attributes, passwordHash });

  return toPublicUser(user);
}

export async function updateUserRole(
  actorId: string,
  targetId: string,
  role: UserRole,
): Promise<PublicUser> {
  if (actorId === targetId && role !== 'admin') {
    throw new ApiError(400, 'You cannot change your own role');
  }

  const user = await findUserOrThrow(targetId);
  user.role = role;
  user.refreshTokenHash = null;
  await user.save();

  return toPublicUser(user);
}

export async function updateUserStatus(
  actorId: string,
  targetId: string,
  isActive: boolean,
): Promise<PublicUser> {
  if (actorId === targetId && !isActive) {
    throw new ApiError(400, 'You cannot deactivate your own account');
  }

  const user = await findUserOrThrow(targetId);
  user.isActive = isActive;
  user.refreshTokenHash = null;
  await user.save();

  return toPublicUser(user);
}

export async function updateProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<PublicUser> {
  const user = await findUserOrThrow(userId);

  if (input.name !== undefined) {
    user.name = input.name;
  }

  if (input.avatar !== undefined) {
    user.avatar = input.avatar;
  }

  if (input.theme !== undefined) {
    user.theme = input.theme;
  }

  if (input.notificationPrefs) {
    const preferences = input.notificationPrefs;

    if (preferences.emailOnAssignment !== undefined) {
      user.notificationPrefs.emailOnAssignment = preferences.emailOnAssignment;
    }

    if (preferences.emailOnMention !== undefined) {
      user.notificationPrefs.emailOnMention = preferences.emailOnMention;
    }

    if (preferences.emailOnStatusChange !== undefined) {
      user.notificationPrefs.emailOnStatusChange = preferences.emailOnStatusChange;
    }

    if (preferences.emailOnReminder !== undefined) {
      user.notificationPrefs.emailOnReminder = preferences.emailOnReminder;
    }
  }

  await user.save();

  return toPublicUser(user);
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await User.findById(userId).select('+passwordHash');

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  const passwordMatches = await user.comparePassword(currentPassword);

  if (!passwordMatches) {
    throw new ApiError(400, 'Current password is incorrect');
  }

  user.passwordHash = await hashPassword(newPassword);
  user.refreshTokenHash = null;
  await user.save();
}

export async function lookupUsers(roles?: UserRole[]): Promise<UserLookupItem[]> {
  const filter: QueryFilter<UserAttributes> = { isActive: true };

  if (roles?.length) {
    filter.role = { $in: roles };
  }

  const users = await User.find(filter).sort({ name: 1 });

  return users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
  }));
}
