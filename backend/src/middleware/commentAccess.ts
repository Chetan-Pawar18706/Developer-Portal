import type { Request, RequestHandler } from 'express';
import { Types } from 'mongoose';
import { Comment, type CommentEntityType } from '../models/comment.model';
import {
  Project,
  type ProjectDocument,
} from '../models/project.model';
import { Requirement } from '../models/requirement.model';
import { Task } from '../models/task.model';
import type { UserRole } from '../models/user.model';
import { canAccessProject } from '../services/project.service';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

/**
 * Resolves the owning project for a comment target. Issues are part of the
 * comment model's contract but their feature ships in a later part.
 */
export async function findProjectForCommentEntity(
  entityType: CommentEntityType,
  entityId: string,
): Promise<ProjectDocument> {
  const id = new Types.ObjectId(entityId);
  let projectId: Types.ObjectId;

  if (entityType === 'project') {
    projectId = id;
  } else if (entityType === 'requirement') {
    const requirement = await Requirement.findById(id).select('project');

    if (!requirement) {
      throw new ApiError(404, 'Requirement not found');
    }

    projectId = requirement.project;
  } else if (entityType === 'task') {
    const task = await Task.findById(id).select('project');

    if (!task) {
      throw new ApiError(404, 'Task not found');
    }

    projectId = task.project;
  } else {
    throw new ApiError(404, 'Issue comments are not available yet');
  }

  const project = await Project.findById(projectId);

  if (!project) {
    throw new ApiError(404, 'Project not found');
  }

  return project;
}

function requireActor(req: Request): { id: string; role: UserRole } {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }

  return req.user;
}

/**
 * Verifies access to the project that owns the entity named in the query or
 * body. Runs after zod validation for both list and create routes.
 */
export const commentEntityAccess: RequestHandler = asyncHandler(async (req, _res, next) => {
  const actor = requireActor(req);
  const source = (req.method === 'GET' ? req.query : req.body) as {
    entityType: CommentEntityType;
    entityId: string;
  };
  const project = await findProjectForCommentEntity(source.entityType, source.entityId);

  if (!canAccessProject(project, actor)) {
    throw new ApiError(403, 'You do not have access to this project');
  }

  req.project = project;
  next();
});

/**
 * Loads a comment by id, verifies project access, and hides internal comments
 * from clients before any update, delete, or reaction handler runs.
 */
export const commentAccess: RequestHandler = asyncHandler(async (req, _res, next) => {
  const actor = requireActor(req);
  const comment = await Comment.findById(req.params.id);

  if (!comment || (actor.role === 'client' && comment.isInternal)) {
    throw new ApiError(404, 'Comment not found');
  }

  const project = await Project.findById(comment.project);

  if (!project) {
    throw new ApiError(404, 'Project not found');
  }

  if (!canAccessProject(project, actor)) {
    throw new ApiError(403, 'You do not have access to this comment');
  }

  req.comment = comment;
  req.project = project;
  next();
});
