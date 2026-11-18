import { z } from 'zod';
import { NOTIFICATION_TYPES } from '../models/notification.model';

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');

const optionalBoolean = z
  .enum(['true', 'false'])
  .optional()
  .transform((value) => value === 'true');

export const listNotificationsQuerySchema = z.object({
  unreadOnly: optionalBoolean,
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const notificationIdParamSchema = z.object({
  id: objectIdSchema,
});

export const notificationTypeSchema = z.enum(NOTIFICATION_TYPES);

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;
export type NotificationTypeInput = z.infer<typeof notificationTypeSchema>;
