import { Router } from 'express';
import * as reportController from '../controllers/report.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { reportQuerySchema } from './report.schemas';

export const reportRouter = Router();

reportRouter.use(authenticate);

reportRouter.get(
  '/',
  validate({ query: reportQuerySchema }),
  asyncHandler(reportController.getReport),
);
