import { Router } from 'express';
import * as userController from '../controllers/user.controller';
import { allow } from '../middleware/allow';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import {
  changePasswordSchema,
  createUserSchema,
  listUsersQuerySchema,
  lookupQuerySchema,
  updateProfileSchema,
  updateRoleSchema,
  updateStatusSchema,
  userIdParamSchema,
} from './user.schemas';

export const userRouter = Router();

userRouter.use(authenticate);

userRouter.get(
  '/',
  allow('admin'),
  validate({ query: listUsersQuerySchema }),
  asyncHandler(userController.listUsers),
);

userRouter.post(
  '/',
  allow('admin'),
  validate({ body: createUserSchema }),
  asyncHandler(userController.createUser),
);

userRouter.get(
  '/lookup',
  allow('pm', 'admin'),
  validate({ query: lookupQuerySchema }),
  asyncHandler(userController.lookupUsers),
);

userRouter.patch(
  '/me',
  validate({ body: updateProfileSchema }),
  asyncHandler(userController.updateMe),
);

userRouter.patch(
  '/me/password',
  validate({ body: changePasswordSchema }),
  asyncHandler(userController.updateMyPassword),
);

userRouter.patch(
  '/:id/role',
  allow('admin'),
  validate({ params: userIdParamSchema, body: updateRoleSchema }),
  asyncHandler(userController.updateUserRole),
);

userRouter.patch(
  '/:id/status',
  allow('admin'),
  validate({ params: userIdParamSchema, body: updateStatusSchema }),
  asyncHandler(userController.updateUserStatus),
);
