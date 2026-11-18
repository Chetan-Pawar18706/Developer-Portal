import { Router } from 'express';
import { upload } from '../config/multer';
import * as fileController from '../controllers/file.controller';
import { authenticate } from '../middleware/auth';
import { fileAccess } from '../middleware/fileAccess';
import { uploadRateLimiter } from '../middleware/rateLimit';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import {
  fileIdParamSchema,
  listFilesQuerySchema,
  newVersionBodySchema,
} from './file.schemas';

export const fileRouter = Router();

fileRouter.use(authenticate);

fileRouter.get(
  '/',
  validate({ query: listFilesQuerySchema }),
  asyncHandler(fileController.listAllFiles),
);

fileRouter.get(
  '/:id/download',
  validate({ params: fileIdParamSchema }),
  fileAccess,
  asyncHandler(fileController.downloadFile),
);

fileRouter.get(
  '/:id/preview',
  validate({ params: fileIdParamSchema }),
  fileAccess,
  asyncHandler(fileController.previewFile),
);

fileRouter.post(
  '/:id/new-version',
  validate({ params: fileIdParamSchema }),
  fileAccess,
  uploadRateLimiter,
  upload.single('file'),
  validate({ body: newVersionBodySchema }),
  asyncHandler(fileController.createFileVersion),
);

fileRouter.delete(
  '/:id',
  validate({ params: fileIdParamSchema }),
  fileAccess,
  asyncHandler(fileController.deleteFile),
);
