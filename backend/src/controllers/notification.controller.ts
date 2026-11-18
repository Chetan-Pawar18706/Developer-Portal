import type { Request, Response } from 'express';
import type { ListNotificationsQuery } from '../routes/notification.schemas';
import * as notificationService from '../services/notification.service';
import { ApiError } from '../utils/ApiError';
import { sendPaginated, sendSuccess } from '../utils/response';

function requireUserId(req: Request): string {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }

  return req.user.id;
}

export async function listNotifications(req: Request, res: Response): Promise<void> {
  const result = await notificationService.listNotifications(
    requireUserId(req),
    req.query as unknown as ListNotificationsQuery,
  );

  sendPaginated(
    res,
    result.data,
    result.total,
    result.page,
    result.limit,
    'Notifications retrieved',
  );
}

export async function getUnreadCount(req: Request, res: Response): Promise<void> {
  const count = await notificationService.getUnreadCount(requireUserId(req));
  sendSuccess(res, { count }, 'Unread count retrieved');
}

export async function markAsRead(req: Request, res: Response): Promise<void> {
  const notification = await notificationService.markNotificationAsRead(
    requireUserId(req),
    req.params.id,
  );

  sendSuccess(res, { notification }, 'Notification marked as read');
}

export async function markAllAsRead(req: Request, res: Response): Promise<void> {
  const updated = await notificationService.markAllNotificationsAsRead(requireUserId(req));
  sendSuccess(res, { updated }, 'All notifications marked as read');
}
