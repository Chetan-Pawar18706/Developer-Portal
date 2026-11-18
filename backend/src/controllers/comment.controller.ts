import type { Request, Response } from 'express';
import type { CommentDocument } from '../models/comment.model';
import type { ProjectDocument } from '../models/project.model';
import type {
  CreateCommentInput,
  ListCommentsQuery,
  ListGlobalCommentsQuery,
  ToggleReactionInput,
  UpdateCommentInput,
} from '../routes/comment.schemas';
import * as commentService from '../services/comment.service';
import { ApiError } from '../utils/ApiError';
import { sendPaginated, sendSuccess } from '../utils/response';

function requireActor(req: Request): commentService.CommentActor {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }

  return req.user;
}

function requireProject(req: Request): ProjectDocument {
  if (!req.project) {
    throw new ApiError(404, 'Project not found');
  }

  return req.project;
}

export async function listGlobalComments(req: Request, res: Response): Promise<void> {
  const result = await commentService.listGlobalComments(
    requireActor(req),
    req.query as unknown as ListGlobalCommentsQuery,
  );

  sendPaginated(res, result.data, result.total, result.page, result.limit, 'Comments retrieved');
}

export async function listComments(req: Request, res: Response): Promise<void> {
  const result = await commentService.listComments(
    requireProject(req),
    requireActor(req),
    req.query as unknown as ListCommentsQuery,
  );

  sendPaginated(res, result.data, result.total, result.page, result.limit, 'Comments retrieved');
}

export async function createComment(req: Request, res: Response): Promise<void> {
  const comment = await commentService.createComment(
    requireProject(req),
    requireActor(req),
    req.body as CreateCommentInput,
  );

  sendSuccess(res, { comment }, 'Comment posted', 201);
}

export async function updateComment(req: Request, res: Response): Promise<void> {
  const comment = await commentService.updateComment(
    requireCommentDocument(req),
    requireProject(req),
    requireActor(req),
    req.body as UpdateCommentInput,
  );

  sendSuccess(res, { comment }, 'Comment updated');
}

export async function deleteComment(req: Request, res: Response): Promise<void> {
  await commentService.deleteComment(requireCommentDocument(req), requireActor(req));
  sendSuccess(res, null, 'Comment deleted');
}

export async function toggleReaction(req: Request, res: Response): Promise<void> {
  const comment = await commentService.toggleReaction(
    requireCommentDocument(req),
    requireActor(req),
    req.body as ToggleReactionInput,
  );

  sendSuccess(res, { comment }, 'Reaction updated');
}

function requireCommentDocument(req: Request): CommentDocument {
  if (!req.comment) {
    throw new ApiError(404, 'Comment not found');
  }

  return req.comment;
}
