import { Schema, Types, model, type HydratedDocument, type Model } from 'mongoose';

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

export interface NotificationAttributes {
  user: Types.ObjectId;
  project: Types.ObjectId;
  type: NotificationType;
  message: string;
  link: string;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type NotificationDocument = HydratedDocument<NotificationAttributes>;
export type NotificationModel = Model<NotificationAttributes>;

const notificationSchema = new Schema<NotificationAttributes, NotificationModel>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    project: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    link: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    isRead: {
      type: Boolean,
      default: false,
      required: true,
    },
  },
  { timestamps: true },
);

notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });

export const Notification = model<NotificationAttributes, NotificationModel>(
  'Notification',
  notificationSchema,
);
