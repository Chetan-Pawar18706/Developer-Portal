import { Router } from 'express';
import * as notificationController from '../controllers/notification.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import {
  listNotificationsQuerySchema,
  notificationIdParamSchema,
} from './notification.schemas';

export const notificationRouter = Router();

notificationRouter.use(authenticate);

notificationRouter.get(
  '/unread-count',
  asyncHandler(notificationController.getUnreadCount),
);

notificationRouter.get(
  '/',
  validate({ query: listNotificationsQuerySchema }),
  asyncHandler(notificationController.listNotifications),
);

notificationRouter.patch(
  '/read-all',
  asyncHandler(notificationController.markAllAsRead),
);

notificationRouter.patch(
  '/:id/read',
  validate({ params: notificationIdParamSchema }),
  asyncHandler(notificationController.markAsRead),
);
