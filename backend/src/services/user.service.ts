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
import { AVATAR_FOLDER, storageService } from './storage.service';
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

export interface DeveloperProfile {
  id: string;
  name: string;
  role: UserRole;
  avatar: string | null;
  jobTitle: string | null;
  company: string | null;
  location: string | null;
  bio: string | null;
  skills: string[];
  website: string | null;
  github: string | null;
  linkedin: string | null;
  createdAt: Date;
}

export interface StoredAvatar {
  buffer: Buffer;
  mimeType: string;
}

function normalizeNullable(value: string | null | undefined): string | null {
  if (value === undefined || value === null || value.trim().length === 0) {
    return null;
  }

  return value;
}

async function clearStoredAvatar(user: UserDocument): Promise<void> {
  if (!user.avatarStoragePath) {
    return;
  }

  const storagePath = user.avatarStoragePath;
  user.avatarStoragePath = null;
  user.avatarMimeType = null;

  try {
    await storageService.remove(storagePath);
  } catch {
    // The avatar URL is cleared even if the old file is already missing.
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function findUserOrThrow(userId: string): Promise<UserDocument> {
  const user = await User.findById(userId).select('+avatarStoragePath +avatarMimeType');

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
    if (input.avatar !== user.avatar) {
      await clearStoredAvatar(user);
    }
    user.avatar = input.avatar;
  }

  if (input.theme !== undefined) {
    user.theme = input.theme;
  }

  if (input.jobTitle !== undefined) {
    user.jobTitle = normalizeNullable(input.jobTitle);
  }

  if (input.company !== undefined) {
    user.company = normalizeNullable(input.company);
  }

  if (input.location !== undefined) {
    user.location = normalizeNullable(input.location);
  }

  if (input.bio !== undefined) {
    user.bio = normalizeNullable(input.bio);
  }

  if (input.skills !== undefined) {
    user.skills = input.skills;
  }

  if (input.website !== undefined) {
    user.website = normalizeNullable(input.website);
  }

  if (input.github !== undefined) {
    user.github = normalizeNullable(input.github);
  }

  if (input.linkedin !== undefined) {
    user.linkedin = normalizeNullable(input.linkedin);
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

export async function getPublicProfile(userId: string): Promise<DeveloperProfile> {
  const user = await findUserOrThrow(userId);

  if (!user.isActive) {
    throw new ApiError(404, 'User not found');
  }

  return {
    id: user.id,
    name: user.name,
    role: user.role,
    avatar: user.avatar,
    jobTitle: user.jobTitle,
    company: user.company,
    location: user.location,
    bio: user.bio,
    skills: [...user.skills],
    website: user.website,
    github: user.github,
    linkedin: user.linkedin,
    createdAt: user.createdAt,
  };
}

export async function updateAvatar(
  userId: string,
  file: Express.Multer.File,
): Promise<PublicUser> {
  const user = await findUserOrThrow(userId);
  const previousPath = user.avatarStoragePath;
  const stored = await storageService.save({
    buffer: file.buffer,
    originalName: file.originalname,
    folder: AVATAR_FOLDER,
  });

  user.avatar = `/api/users/${user.id}/avatar`;
  user.avatarStoragePath = stored.storagePath;
  user.avatarMimeType = file.mimetype.toLowerCase();
  await user.save();

  if (previousPath && previousPath !== stored.storagePath) {
    try {
      await storageService.remove(previousPath);
    } catch {
      // The new avatar is already saved; an old-file cleanup failure is non-fatal.
    }
  }

  return toPublicUser(user);
}

export async function getStoredAvatar(userId: string): Promise<StoredAvatar> {
  const user = await findUserOrThrow(userId);

  if (!user.isActive || !user.avatarStoragePath || !user.avatarMimeType) {
    throw new ApiError(404, 'Profile picture not found');
  }

  const buffer = await storageService.read(user.avatarStoragePath);

  return { buffer, mimeType: user.avatarMimeType };
}
