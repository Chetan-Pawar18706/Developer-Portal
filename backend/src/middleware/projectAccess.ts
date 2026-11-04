import type { RequestHandler } from 'express';
import { Project, type ProjectDocument } from '../models/project.model';
import { canAccessProject } from '../services/project.service';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

/**
 * Loads the project named by `req.params.id` and enforces stakeholder access.
 * The hydrated document is attached as `req.project` for downstream handlers.
 */
export const projectAccess: RequestHandler = asyncHandler(async (req, _res, next) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }

  const project = await Project.findById(req.params.id);

  if (!project) {
    throw new ApiError(404, 'Project not found');
  }

  if (!canAccessProject(project, req.user)) {
    throw new ApiError(403, 'You do not have access to this project');
  }

  req.project = project as ProjectDocument;
  next();
});
