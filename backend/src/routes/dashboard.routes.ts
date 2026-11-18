import { Router } from 'express';
import * as dashboardController from '../controllers/dashboard.controller';
import { allow } from '../middleware/allow';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

export const dashboardRouter = Router();

dashboardRouter.use(authenticate);

dashboardRouter.get(
  '/admin',
  allow('admin'),
  asyncHandler(dashboardController.getAdminDashboard),
);

dashboardRouter.get('/me', asyncHandler(dashboardController.getMeDashboard));
