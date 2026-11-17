import type { RequestHandler } from 'express';
import { Project, type ProjectDocument } from '../models/project.model';
import { Task, type TaskDocument } from '../models/task.model';
import { canAccessProject } from '../services/project.service';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

/**
 * Loads a task and its project, then enforces project-level access before any
 * task-scoped handler runs.
 */
export const taskAccess: RequestHandler = asyncHandler(async (req, _res, next) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }

  const task = await Task.findById(req.params.id);

  if (!task) {
    throw new ApiError(404, 'Task not found');
  }

  const project = await Project.findById(task.project);

  if (!project) {
    throw new ApiError(404, 'Project not found');
  }

  if (!canAccessProject(project, req.user)) {
    throw new ApiError(403, 'You do not have access to this task');
  }

  req.task = task as TaskDocument;
  req.project = project as ProjectDocument;
  next();
});
