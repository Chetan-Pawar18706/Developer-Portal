import type { QueryFilter } from 'mongoose';
import { Types } from 'mongoose';
import { env } from '../config/env';
import {
  Notification,
  type NotificationAttributes,
  type NotificationDocument,
  type NotificationType,
} from '../models/notification.model';
import type { ProjectDocument } from '../models/project.model';
import {
  User,
  type NotificationPreferences,
  type UserRole,
} from '../models/user.model';
import type { ListNotificationsQuery } from '../routes/notification.schemas';
import { ApiError } from '../utils/ApiError';
import { sendNotificationEmail } from './email.service';

const EMAIL_PREFERENCE_KEYS: Record<
  NotificationType,
  keyof NotificationPreferences | null
> = {
  task_assigned: 'emailOnAssignment',
  mention: 'emailOnMention',
  requirement_status_changed: 'emailOnStatusChange',
  issue_status_changed: 'emailOnStatusChange',
  task_client_review: 'emailOnStatusChange',
  project_status_changed: 'emailOnStatusChange',
  task_due_reminder: 'emailOnReminder',
  task_overdue: 'emailOnReminder',
};

const EMAIL_SUBJECTS: Record<NotificationType, string> = {
  task_assigned: 'A task was assigned to you',
  mention: 'You were mentioned in a comment',
  requirement_status_changed: 'A requirement status changed',
  issue_status_changed: 'An issue status changed',
  task_client_review: 'A task was reviewed',
  project_status_changed: 'A project status changed',
  task_due_reminder: 'A task is due soon',
  task_overdue: 'A task is overdue',
};

const EMAIL_TITLES: Record<NotificationType, string> = {
  task_assigned: 'New task assignment',
  mention: 'You were mentioned',
  requirement_status_changed: 'Requirement update',
  issue_status_changed: 'Issue update',
  task_client_review: 'Client review update',
  project_status_changed: 'Project update',
  task_due_reminder: 'Upcoming task deadline',
  task_overdue: 'Overdue task',
};

export interface NotifyPayload {
  projectId: string;
  type: NotificationType;
  message: string;
  link: string;
}

export interface PublicNotification {
  id: string;
  projectId: string;
  type: NotificationType;
  message: string;
  link: string;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationListResult {
  data: PublicNotification[];
  total: number;
  page: number;
  limit: number;
}

function toPublicNotification(notification: NotificationDocument): PublicNotification {
  return {
    id: notification.id,
    projectId: notification.project.toString(),
    type: notification.type,
    message: notification.message,
    link: notification.link,
    isRead: notification.isRead,
    createdAt: notification.createdAt,
    updatedAt: notification.updatedAt,
  };
}

function uniqueIds(userIds: readonly string[]): Types.ObjectId[] {
  const seen = new Set<string>();

  for (const userId of userIds) {
    if (/^[a-f\d]{24}$/i.test(userId)) {
      seen.add(userId);
    }
  }

  return [...seen].map((userId) => new Types.ObjectId(userId));
}

/**
 * Creates one in-app notification per recipient, then sends email only to
 * recipients whose preferences enable this notification type.
 */
export async function notify(
  userIds: readonly string[],
  payload: NotifyPayload,
): Promise<void> {
  const objectIds = uniqueIds(userIds);

  if (objectIds.length === 0) {
    return;
  }

  const users = await User.find({
    _id: { $in: objectIds },
    isActive: true,
  }).select('name email notificationPrefs');

  if (users.length === 0) {
    return;
  }

  await Notification.insertMany(
    users.map((user) => ({
      user: user._id,
      project: new Types.ObjectId(payload.projectId),
      type: payload.type,
      message: payload.message,
      link: payload.link,
      isRead: false,
    })),
  );

  const preferenceKey = EMAIL_PREFERENCE_KEYS[payload.type];
  const emailRecipients =
    preferenceKey === null
      ? []
      : users.filter((user) => user.notificationPrefs[preferenceKey]);

  await Promise.all(
    emailRecipients.map(async (user) => {
      try {
        await sendNotificationEmail({
          to: user.email,
          subject: EMAIL_SUBJECTS[payload.type],
          title: EMAIL_TITLES[payload.type],
          message: payload.message,
          link: `${env.CLIENT_URL}${payload.link}`,
        });
      } catch (error: unknown) {
        console.error(`Unable to send notification email to ${user.email}:`, error);
      }
    }),
  );
}

export function projectTeamRecipientIds(
  project: ProjectDocument,
  actorId: string,
  options: { includeAllMembers?: boolean; roles?: readonly UserRole[] } = {},
): string[] {
  const recipients = new Set<string>([project.client.toString()]);

  for (const member of project.members) {
    const memberId = member.user.toString();
    const roleMatches =
      !options.roles || options.roles.includes(member.role);

    if (options.includeAllMembers || roleMatches) {
      recipients.add(memberId);
    }
  }

  recipients.delete(actorId);
  return [...recipients];
}

export async function notifyProjectTeam(
  project: ProjectDocument,
  actorId: string,
  payload: NotifyPayload,
  options: { includeAllMembers?: boolean; roles?: readonly UserRole[] } = {},
): Promise<void> {
  await notify(projectTeamRecipientIds(project, actorId, options), payload);
}

export async function listNotifications(
  userId: string,
  query: ListNotificationsQuery,
): Promise<NotificationListResult> {
  const filter: QueryFilter<NotificationAttributes> = {
    user: new Types.ObjectId(userId),
  };

  if (query.unreadOnly) {
    filter.isRead = false;
  }

  const direction = query.sortOrder === 'asc' ? 1 : -1;
  const skip = (query.page - 1) * query.limit;

  const [notifications, total] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: direction })
      .skip(skip)
      .limit(query.limit),
    Notification.countDocuments(filter),
  ]);

  return {
    data: notifications.map(toPublicNotification),
    total,
    page: query.page,
    limit: query.limit,
  };
}

export async function getUnreadCount(userId: string): Promise<number> {
  return Notification.countDocuments({
    user: new Types.ObjectId(userId),
    isRead: false,
  });
}

export async function markNotificationAsRead(
  userId: string,
  notificationId: string,
): Promise<PublicNotification> {
  const notification = await Notification.findOne({
    _id: new Types.ObjectId(notificationId),
    user: new Types.ObjectId(userId),
  });

  if (!notification) {
    throw new ApiError(404, 'Notification not found');
  }

  notification.isRead = true;
  await notification.save();
  return toPublicNotification(notification);
}

export async function markAllNotificationsAsRead(userId: string): Promise<number> {
  const result = await Notification.updateMany(
    { user: new Types.ObjectId(userId), isRead: false },
    { $set: { isRead: true } },
  );

  return result.modifiedCount;
}
