import { Schema, Types, model, type HydratedDocument, type Model } from 'mongoose';

export const ACTIVITY_ACTIONS = [
  'project_created',
  'project_updated',
  'project_archived',
  'status_changed',
  'member_added',
  'member_removed',
  'requirement_created',
  'requirement_updated',
  'requirement_status_changed',
  'requirement_change_requested',
  'task_created',
  'task_updated',
  'task_status_changed',
  'task_deleted',
  'task_time_logged',
  'task_subtasks_updated',
  'task_client_reviewed',
] as const;

export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export const ACTIVITY_ENTITY_TYPES = [
  'project',
  'member',
  'status',
  'requirement',
  'task',
] as const;
export type ActivityEntityType = (typeof ACTIVITY_ENTITY_TYPES)[number];

export interface ActivityLogAttributes {
  project: Types.ObjectId;
  actor: Types.ObjectId;
  action: ActivityAction;
  entityType: ActivityEntityType;
  entityId: Types.ObjectId | null;
  meta: Record<string, unknown>;
  createdAt: Date;
}

export type ActivityLogDocument = HydratedDocument<ActivityLogAttributes>;
export type ActivityLogModel = Model<ActivityLogAttributes>;

const activityLogSchema = new Schema<ActivityLogAttributes, ActivityLogModel>(
  {
    project: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    actor: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action: {
      type: String,
      enum: ACTIVITY_ACTIONS,
      required: true,
    },
    entityType: {
      type: String,
      enum: ACTIVITY_ENTITY_TYPES,
      required: true,
    },
    entityId: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    meta: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

activityLogSchema.index({ project: 1, createdAt: -1 });

export const ActivityLog = model<ActivityLogAttributes, ActivityLogModel>(
  'ActivityLog',
  activityLogSchema,
);
