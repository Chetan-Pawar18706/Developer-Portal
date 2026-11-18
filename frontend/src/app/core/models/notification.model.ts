export const NOTIFICATION_TYPES = [
  'task_assigned',
  'mention',
  'requirement_status_changed',
  'issue_status_changed',
  'task_client_review',
  'project_status_changed',
  'task_due_reminder',
  'task_overdue',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface Notification {
  id: string;
  projectId: string;
  type: NotificationType;
  message: string;
  link: string;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationListQuery {
  unreadOnly?: boolean;
  page: number;
  limit: number;
  sortBy: 'createdAt';
  sortOrder: 'asc' | 'desc';
}

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  task_assigned: 'Task assigned',
  mention: 'Mention',
  requirement_status_changed: 'Requirement',
  issue_status_changed: 'Issue',
  task_client_review: 'Client review',
  project_status_changed: 'Project',
  task_due_reminder: 'Due soon',
  task_overdue: 'Overdue',
};
