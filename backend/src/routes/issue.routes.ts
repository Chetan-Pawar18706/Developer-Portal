import { Router } from 'express';
import * as issueController from '../controllers/issue.controller';
import { authenticate } from '../middleware/auth';
import { issueAccess } from '../middleware/issueAccess';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import {
  issueIdParamSchema,
  updateIssueSchema,
  updateIssueStatusSchema,
} from './issue.schemas';

export const issueRouter = Router();

issueRouter.use(authenticate);

issueRouter.get(
  '/:id',
  validate({ params: issueIdParamSchema }),
  issueAccess,
  asyncHandler(issueController.getIssue),
);

issueRouter.patch(
  '/:id',
  validate({ params: issueIdParamSchema, body: updateIssueSchema }),
  issueAccess,
  asyncHandler(issueController.updateIssue),
);

issueRouter.patch(
  '/:id/status',
  validate({ params: issueIdParamSchema, body: updateIssueStatusSchema }),
  issueAccess,
  asyncHandler(issueController.changeIssueStatus),
);

issueRouter.post(
  '/:id/convert-to-task',
  validate({ params: issueIdParamSchema }),
  issueAccess,
  asyncHandler(issueController.convertIssueToTask),
);
