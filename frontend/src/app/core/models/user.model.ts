export const ROLES = ['admin', 'pm', 'developer', 'client'] as const;

export type Role = (typeof ROLES)[number];

export interface NotificationPreferences {
  emailOnAssignment: boolean;
  emailOnMention: boolean;
  emailOnStatusChange: boolean;
  emailOnReminder: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar: string | null;
  isActive: boolean;
  notificationPrefs: NotificationPreferences;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
  role: Role;
  isActive?: boolean;
}

export interface UserListQuery {
  search?: string;
  role?: Role;
  isActive?: boolean;
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrator',
  pm: 'Project Manager',
  developer: 'Developer',
  client: 'Client',
};
