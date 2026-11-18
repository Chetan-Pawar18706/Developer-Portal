import type { Request, RequestHandler } from 'express';
import { Project, type ProjectDocument } from '../models/project.model';
import { Issue, type IssueDocument } from '../models/issue.model';
import type { UserRole } from '../models/user.model';
import { canAccessProject } from '../services/project.service';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

function requireActor(req: Request): { id: string; role: UserRole } {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }

  return req.user;
}

/** Loads an issue, its project, and enforces project-level stakeholder access. */
export const issueAccess: RequestHandler = asyncHandler(async (req, _res, next) => {
  const actor = requireActor(req);
  const issue = await Issue.findById(req.params.id);

  if (!issue) {
    throw new ApiError(404, 'Issue not found');
  }

  const project = await Project.findById(issue.project);

  if (!project) {
    throw new ApiError(404, 'Project not found');
  }

  if (!canAccessProject(project, actor)) {
    throw new ApiError(403, 'You do not have access to this issue');
  }

  req.issue = issue as IssueDocument;
  req.project = project as ProjectDocument;
  next();
});
