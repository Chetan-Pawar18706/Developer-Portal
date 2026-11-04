import { Types } from 'mongoose';
import {
  ActivityLog,
  type ActivityAction,
  type ActivityEntityType,
} from '../models/activityLog.model';

export interface LogActivityInput {
  projectId: string | Types.ObjectId;
  actorId: string | Types.ObjectId;
  action: ActivityAction;
  entityType: ActivityEntityType;
  entityId?: string | Types.ObjectId | null;
  meta?: Record<string, unknown>;
}

/**
 * Appends an immutable audit entry. Activity logging must never make a business
 * operation fail, so write errors are reported without being rethrown.
 */
export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    await ActivityLog.create({
      project: input.projectId,
      actor: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      meta: input.meta ?? {},
    });
  } catch (error) {
    console.error('Failed to write activity log:', error);
  }
}
