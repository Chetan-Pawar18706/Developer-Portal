import { z } from 'zod';
import { USER_THEMES } from '../models/user.model';

const emailSchema = z.string().trim().toLowerCase().email();

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: emailSchema,
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(32),
  password: z.string().min(8).max(128),
});

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
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
        value.theme !== undefined ||
        value.notificationPrefs !== undefined,
    { message: 'Provide a name, theme or notification preference to update' },
  );

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
