import { Router } from 'express';
import * as requirementController from '../controllers/requirement.controller';
import * as taskController from '../controllers/task.controller';
import { allow } from '../middleware/allow';
import { authenticate } from '../middleware/auth';
import { requirementAccess } from '../middleware/requirementAccess';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import {
  createChangeRequestSchema,
  listAllRequirementsQuerySchema,
  requirementIdParamSchema,
  updateRequirementSchema,
  updateRequirementStatusSchema,
} from './requirement.schemas';

export const requirementRouter = Router();

requirementRouter.use(authenticate);

requirementRouter.get(
  '/',
  validate({ query: listAllRequirementsQuerySchema }),
  asyncHandler(requirementController.listRequirements),
);

requirementRouter.get(
  '/:id/progress',
  validate({ params: requirementIdParamSchema }),
  requirementAccess,
  asyncHandler(taskController.getRequirementProgress),
);

requirementRouter.get(
  '/:id',
  validate({ params: requirementIdParamSchema }),
  requirementAccess,
  asyncHandler(requirementController.getRequirement),
);

requirementRouter.patch(
  '/:id/status',
  allow('admin', 'pm', 'client'),
  validate({ params: requirementIdParamSchema, body: updateRequirementStatusSchema }),
  requirementAccess,
  asyncHandler(requirementController.changeRequirementStatus),
);

requirementRouter.post(
  '/:id/change-request',
  allow('admin', 'pm', 'client'),
  validate({ params: requirementIdParamSchema, body: createChangeRequestSchema }),
  requirementAccess,
  asyncHandler(requirementController.createChangeRequest),
);

requirementRouter.patch(
  '/:id',
  allow('admin', 'pm', 'client'),
  validate({ params: requirementIdParamSchema, body: updateRequirementSchema }),
  requirementAccess,
  asyncHandler(requirementController.updateRequirement),
);
