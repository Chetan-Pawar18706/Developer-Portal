import {
  User,
  hashPassword,
  type UserDocument,
  type UserRole,
} from '../models/user.model';
import { signAccessToken } from '../utils/token';

export const defaultPassword = 'Password123!';

export interface CreateUserOptions {
  name?: string;
  email?: string;
  password?: string;
  role?: UserRole;
  isActive?: boolean;
}

export async function createUser(options: CreateUserOptions = {}): Promise<UserDocument> {
  const {
    name = 'Test User',
    email = 'test@example.com',
    password = defaultPassword,
    role = 'client',
    isActive = true,
  } = options;

  return User.create({
    name,
    email,
    passwordHash: await hashPassword(password),
    role,
    isActive,
  });
}

export function bearerToken(user: UserDocument): string {
  return `Bearer ${signAccessToken(user.id, user.role)}`;
}
