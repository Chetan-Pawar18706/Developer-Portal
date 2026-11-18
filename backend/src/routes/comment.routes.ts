import { Router } from 'express';
import * as commentController from '../controllers/comment.controller';
import { authenticate } from '../middleware/auth';
import { commentAccess, commentEntityAccess } from '../middleware/commentAccess';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import {
  commentIdParamSchema,
  createCommentSchema,
  listCommentsQuerySchema,
  listGlobalCommentsQuerySchema,
  toggleReactionSchema,
  updateCommentSchema,
} from './comment.schemas';

export const commentRouter = Router();

commentRouter.use(authenticate);

commentRouter.get(
  '/global',
  validate({ query: listGlobalCommentsQuerySchema }),
  asyncHandler(commentController.listGlobalComments),
);

commentRouter.get(
  '/',
  validate({ query: listCommentsQuerySchema }),
  commentEntityAccess,
  asyncHandler(commentController.listComments),
);

commentRouter.post(
  '/',
  validate({ body: createCommentSchema }),
  commentEntityAccess,
  asyncHandler(commentController.createComment),
);

commentRouter.patch(
  '/:id',
  validate({ params: commentIdParamSchema, body: updateCommentSchema }),
  commentAccess,
  asyncHandler(commentController.updateComment),
);

commentRouter.delete(
  '/:id',
  validate({ params: commentIdParamSchema }),
  commentAccess,
  asyncHandler(commentController.deleteComment),
);

commentRouter.post(
  '/:id/reactions',
  validate({ params: commentIdParamSchema, body: toggleReactionSchema }),
  commentAccess,
  asyncHandler(commentController.toggleReaction),
);
