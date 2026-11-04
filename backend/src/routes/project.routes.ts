import { Router } from 'express';
import * as projectController from '../controllers/project.controller';
import * as requirementController from '../controllers/requirement.controller';
import { allow } from '../middleware/allow';
import { authenticate } from '../middleware/auth';
import { projectAccess } from '../middleware/projectAccess';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import {
  addProjectMemberSchema,
  createProjectSchema,
  listProjectsQuerySchema,
  projectIdParamSchema,
  projectMemberParamSchema,
  updateProjectSchema,
  updateProjectStatusSchema,
} from './project.schemas';
import {
  createRequirementSchema,
  listRequirementsQuerySchema,
  projectRequirementParamSchema,
} from './requirement.schemas';

export const projectRouter = Router();

projectRouter.use(authenticate);

projectRouter.get(
  '/',
  validate({ query: listProjectsQuerySchema }),
  asyncHandler(projectController.listProjects),
);

projectRouter.post(
  '/',
  allow('admin', 'pm', 'client'),
  validate({ body: createProjectSchema }),
  asyncHandler(projectController.createProject),
);

projectRouter.get(
  '/:id/requirements',
  validate({
    params: projectRequirementParamSchema,
    query: listRequirementsQuerySchema,
  }),
  projectAccess,
  asyncHandler(requirementController.listProjectRequirements),
);

projectRouter.post(
  '/:id/requirements',
  allow('admin', 'pm', 'client'),
  validate({
    params: projectRequirementParamSchema,
    body: createRequirementSchema,
  }),
  projectAccess,
  asyncHandler(requirementController.createProjectRequirement),
);

projectRouter.get(
  '/:id/activity',
  validate({ params: projectIdParamSchema }),
  projectAccess,
  asyncHandler(projectController.getActivity),
);

projectRouter.post(
  '/:id/members',
  allow('admin', 'pm'),
  validate({ params: projectIdParamSchema, body: addProjectMemberSchema }),
  projectAccess,
  asyncHandler(projectController.addMember),
);

projectRouter.delete(
  '/:id/members/:userId',
  allow('admin', 'pm'),
  validate({ params: projectMemberParamSchema }),
  projectAccess,
  asyncHandler(projectController.removeMember),
);

projectRouter.patch(
  '/:id/status',
  allow('admin', 'pm', 'client'),
  validate({ params: projectIdParamSchema, body: updateProjectStatusSchema }),
  projectAccess,
  asyncHandler(projectController.changeStatus),
);

projectRouter.get(
  '/:id',
  validate({ params: projectIdParamSchema }),
  projectAccess,
  asyncHandler(projectController.getProject),
);

projectRouter.patch(
  '/:id',
  allow('admin', 'pm', 'client'),
  validate({ params: projectIdParamSchema, body: updateProjectSchema }),
  projectAccess,
  asyncHandler(projectController.updateProject),
);

projectRouter.delete(
  '/:id',
  allow('admin', 'pm'),
  validate({ params: projectIdParamSchema }),
  projectAccess,
  asyncHandler(projectController.archiveProject),
);
