import { z } from 'zod';
import { USER_ROLES, USER_THEMES } from '../models/user.model';

export const userRoleSchema = z.enum(USER_ROLES);

const emailSchema = z.string().trim().toLowerCase().email();

export const createUserSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: emailSchema,
  password: z.string().min(8).max(128),
  role: userRoleSchema.default('client'),
  avatar: z.string().trim().max(2048).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const updateRoleSchema = z.object({
  role: userRoleSchema,
});

export const updateStatusSchema = z.object({
  isActive: z.boolean(),
});

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    avatar: z.string().trim().max(2048).nullable().optional(),
    theme: z.enum(USER_THEMES).optional(),
    notificationPrefs: z
      .object({
        emailOnAssignment: z.boolean().optional(),
        emailOnMention: z.boolean().optional(),
        emailOnStatusChange: z.boolean().optional(),
        emailOnReminder: z.boolean().optional(),
      })
      .optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.avatar !== undefined ||
      value.theme !== undefined ||
      value.notificationPrefs !== undefined,
    { message: 'At least one profile field is required' },
  );

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

export const listUsersQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  role: userRoleSchema.optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z
    .enum(['name', 'email', 'role', 'isActive', 'createdAt', 'updatedAt'])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const lookupQuerySchema = z.object({
  role: z
    .string()
    .optional()
    .transform((value) =>
      value
        ? value
            .split(',')
            .map((role) => role.trim())
            .filter((role) => role.length > 0)
        : undefined,
    )
    .pipe(z.array(userRoleSchema).optional()),
});

export const userIdParamSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid user id'),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type LookupQuery = z.infer<typeof lookupQuerySchema>;
