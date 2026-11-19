import type { Request, Response } from 'express';
import * as userService from '../services/user.service';
import type {
  ChangePasswordInput,
  CreateUserInput,
  ListUsersQuery,
  LookupQuery,
  UpdateProfileInput,
  UpdateRoleInput,
  UpdateStatusInput,
} from '../routes/user.schemas';
import { ApiError } from '../utils/ApiError';
import { sendPaginated, sendSuccess } from '../utils/response';

function requireActor(req: Request): { id: string; role: NonNullable<Request['user']>['role'] } {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }

  return req.user;
}

export async function listUsers(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as ListUsersQuery;
  const result = await userService.listUsers(query);

  sendPaginated(res, result.data, result.total, result.page, result.limit);
}

export async function createUser(req: Request, res: Response): Promise<void> {
  const user = await userService.createUserByAdmin(req.body as CreateUserInput);

  sendSuccess(res, { user }, 'User created', 201);
}

export async function updateUserRole(req: Request, res: Response): Promise<void> {
  const actor = requireActor(req);
  const { role } = req.body as UpdateRoleInput;
  const user = await userService.updateUserRole(actor.id, req.params.id, role);

  sendSuccess(res, { user }, 'User role updated');
}

export async function updateUserStatus(req: Request, res: Response): Promise<void> {
  const actor = requireActor(req);
  const { isActive } = req.body as UpdateStatusInput;
  const user = await userService.updateUserStatus(actor.id, req.params.id, isActive);

  sendSuccess(res, { user }, 'User status updated');
}

export async function updateMe(req: Request, res: Response): Promise<void> {
  const actor = requireActor(req);
  const user = await userService.updateProfile(actor.id, req.body as UpdateProfileInput);

  sendSuccess(res, { user }, 'Profile updated');
}

export async function updateMyPassword(req: Request, res: Response): Promise<void> {
  const actor = requireActor(req);
  const { currentPassword, newPassword } = req.body as ChangePasswordInput;

  await userService.changePassword(actor.id, currentPassword, newPassword);
  sendSuccess(res, null, 'Password updated successfully');
}

export async function lookupUsers(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as LookupQuery;
  const users = await userService.lookupUsers(query.role);

  sendSuccess(res, { users }, 'Users retrieved');
}

export async function getProfile(req: Request, res: Response): Promise<void> {
  const profile = await userService.getPublicProfile(req.params.id);

  sendSuccess(res, { profile }, 'Developer profile retrieved');
}

export async function uploadAvatar(req: Request, res: Response): Promise<void> {
  const actor = requireActor(req);

  if (!req.file) {
    throw new ApiError(400, 'Profile picture is required');
  }

  const user = await userService.updateAvatar(actor.id, req.file);

  sendSuccess(res, { user }, 'Profile picture updated');
}

export async function getAvatar(req: Request, res: Response): Promise<void> {
  const avatar = await userService.getStoredAvatar(req.params.id);

  res.setHeader('Content-Type', avatar.mimeType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.send(avatar.buffer);
}
