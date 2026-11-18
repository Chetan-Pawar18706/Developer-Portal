import { Router } from 'express';
import { upload } from '../config/multer';
import * as dashboardController from '../controllers/dashboard.controller';
import * as fileController from '../controllers/file.controller';
import * as issueController from '../controllers/issue.controller';
import * as projectController from '../controllers/project.controller';
import * as requirementController from '../controllers/requirement.controller';
import * as taskController from '../controllers/task.controller';
import { allow } from '../middleware/allow';
import { authenticate } from '../middleware/auth';
import { projectAccess } from '../middleware/projectAccess';
import { uploadRateLimiter } from '../middleware/rateLimit';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import {
  addProjectMemberSchema,
  createProjectSchema,
  listProjectsQuerySchema,
  projectIdParamSchema,
  projectMemberParamSchema,
  signOffProjectSchema,
  updateProjectSchema,
  updateProjectStatusSchema,
} from './project.schemas';
import {
  createFilesBodySchema,
  listFilesQuerySchema,
} from './file.schemas';
import {
  createIssueSchema,
  listIssuesQuerySchema,
  projectIssueParamSchema,
} from './issue.schemas';
import {
  createRequirementSchema,
  listRequirementsQuerySchema,
  projectRequirementParamSchema,
} from './requirement.schemas';
import {
  createTaskSchema,
  listTasksQuerySchema,
  taskIdParamSchema,
} from './task.schemas';

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
  '/:id/issues',
  validate({ params: projectIssueParamSchema, query: listIssuesQuerySchema }),
  projectAccess,
  asyncHandler(issueController.listProjectIssues),
);

projectRouter.post(
  '/:id/issues',
  validate({ params: projectIssueParamSchema, body: createIssueSchema }),
  projectAccess,
  asyncHandler(issueController.createProjectIssue),
);

projectRouter.get(
  '/:id/tasks',
  validate({ params: taskIdParamSchema, query: listTasksQuerySchema }),
  projectAccess,
  asyncHandler(taskController.listProjectTasks),
);

projectRouter.post(
  '/:id/tasks',
  allow('admin', 'pm'),
  validate({ params: taskIdParamSchema, body: createTaskSchema }),
  projectAccess,
  asyncHandler(taskController.createTask),
);

projectRouter.get(
  '/:id/dashboard',
  validate({ params: projectIdParamSchema }),
  projectAccess,
  asyncHandler(dashboardController.getProjectDashboard),
);

projectRouter.get(
  '/:id/dashboard/pm',
  allow('admin', 'pm'),
  validate({ params: projectIdParamSchema }),
  projectAccess,
  asyncHandler(dashboardController.getProjectPmDashboard),
);

projectRouter.get(
  '/:id/report.pdf',
  validate({ params: projectIdParamSchema }),
  projectAccess,
  asyncHandler(dashboardController.downloadProjectReport),
);

projectRouter.get(
  '/:id/files',
  validate({ params: projectIdParamSchema, query: listFilesQuerySchema }),
  projectAccess,
  asyncHandler(fileController.listProjectFiles),
);

projectRouter.post(
  '/:id/files',
  validate({ params: projectIdParamSchema }),
  projectAccess,
  uploadRateLimiter,
  upload.array('files', 20),
  validate({ body: createFilesBodySchema }),
  asyncHandler(fileController.createProjectFiles),
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

projectRouter.patch(
  '/:id/sign-off',
  allow('client'),
  validate({ params: projectIdParamSchema, body: signOffProjectSchema }),
  projectAccess,
  asyncHandler(projectController.signOff),
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
