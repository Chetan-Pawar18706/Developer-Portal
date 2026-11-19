export const ROLES = ['admin', 'pm', 'developer', 'client'] as const;

export type Role = (typeof ROLES)[number];
export type UserRole = Role;
export type UserTheme = 'light' | 'dark';

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
  jobTitle: string | null;
  company: string | null;
  location: string | null;
  bio: string | null;
  skills: string[];
  website: string | null;
  github: string | null;
  linkedin: string | null;
  isActive: boolean;
  notificationPrefs: NotificationPreferences;
  theme: UserTheme;
  createdAt: string;
  updatedAt: string;
}

export interface DeveloperProfile {
  id: string;
  name: string;
  role: Role;
  avatar: string | null;
  jobTitle: string | null;
  company: string | null;
  location: string | null;
  bio: string | null;
  skills: string[];
  website: string | null;
  github: string | null;
  linkedin: string | null;
  createdAt: string;
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

export interface UpdateProfileRequest {
  name?: string;
  avatar?: string | null;
  theme?: UserTheme;
  jobTitle?: string | null;
  company?: string | null;
  location?: string | null;
  bio?: string | null;
  skills?: string[];
  website?: string | null;
  github?: string | null;
  linkedin?: string | null;
  notificationPrefs?: Partial<NotificationPreferences>;
}

export interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
  role: Role;
  avatar?: string | null;
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

export function socialProfileUrl(platform: 'github' | 'linkedin', value: string): string {
  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  return platform === 'github'
    ? `https://github.com/${value}`
    : `https://www.linkedin.com/in/${value}`;
}
