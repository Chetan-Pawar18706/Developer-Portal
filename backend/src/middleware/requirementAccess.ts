import type { RequestHandler } from 'express';
import { Project, type ProjectDocument } from '../models/project.model';
import { Requirement, type RequirementDocument } from '../models/requirement.model';
import { canAccessProject } from '../services/project.service';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

/**
 * Loads a requirement, its project and enforces stakeholder access before any
 * requirement-scoped handler runs.
 */
export const requirementAccess: RequestHandler = asyncHandler(async (req, _res, next) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }

  const requirement = await Requirement.findById(req.params.id);

  if (!requirement) {
    throw new ApiError(404, 'Requirement not found');
  }

  const project = await Project.findById(requirement.project);

  if (!project) {
    throw new ApiError(404, 'Project not found');
  }

  if (!canAccessProject(project, req.user)) {
    throw new ApiError(403, 'You do not have access to this requirement');
  }

  req.requirement = requirement as RequirementDocument;
  req.project = project as ProjectDocument;
  next();
});
