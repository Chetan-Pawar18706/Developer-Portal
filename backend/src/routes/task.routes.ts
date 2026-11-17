import { Router } from 'express';
import * as taskController from '../controllers/task.controller';
import { allow } from '../middleware/allow';
import { authenticate } from '../middleware/auth';
import { taskAccess } from '../middleware/taskAccess';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import {
  addTimeLogSchema,
  clientReviewSchema,
  moveTaskSchema,
  taskIdParamSchema,
  updateSubtasksSchema,
  updateTaskSchema,
} from './task.schemas';

export const taskRouter = Router();

taskRouter.use(authenticate);

taskRouter.get(
  '/:id',
  validate({ params: taskIdParamSchema }),
  taskAccess,
  asyncHandler(taskController.getTask),
);

taskRouter.patch(
  '/:id',
  allow('admin', 'pm', 'developer'),
  validate({ params: taskIdParamSchema, body: updateTaskSchema }),
  taskAccess,
  asyncHandler(taskController.updateTask),
);

taskRouter.delete(
  '/:id',
  allow('admin', 'pm'),
  validate({ params: taskIdParamSchema }),
  taskAccess,
  asyncHandler(taskController.deleteTask),
);

taskRouter.patch(
  '/:id/move',
  allow('admin', 'pm', 'developer'),
  validate({ params: taskIdParamSchema, body: moveTaskSchema }),
  taskAccess,
  asyncHandler(taskController.moveTask),
);

taskRouter.post(
  '/:id/time-logs',
  allow('admin', 'pm', 'developer'),
  validate({ params: taskIdParamSchema, body: addTimeLogSchema }),
  taskAccess,
  asyncHandler(taskController.addTimeLog),
);

taskRouter.patch(
  '/:id/subtasks',
  allow('admin', 'pm', 'developer'),
  validate({ params: taskIdParamSchema, body: updateSubtasksSchema }),
  taskAccess,
  asyncHandler(taskController.updateSubtasks),
);

taskRouter.post(
  '/:id/client-review',
  allow('client'),
  validate({ params: taskIdParamSchema, body: clientReviewSchema }),
  taskAccess,
  asyncHandler(taskController.reviewTask),
);
