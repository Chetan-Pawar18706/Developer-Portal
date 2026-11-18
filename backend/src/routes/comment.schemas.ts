import { z } from 'zod';
import { COMMENT_ENTITY_TYPES } from '../models/comment.model';

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');

export const commentEntityTypeSchema = z.enum(COMMENT_ENTITY_TYPES);

const commentAttachmentSchema = z.object({
  name: z.string().trim().min(1).max(200),
  url: z.string().trim().url().max(2000),
  mimeType: z.string().trim().max(120).default(''),
  size: z.number().int().min(0).max(500_000_000).default(0),
});

export const listCommentsQuerySchema = z.object({
  entityType: commentEntityTypeSchema,
  entityId: objectIdSchema,
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const createCommentSchema = z.object({
  entityType: commentEntityTypeSchema,
  entityId: objectIdSchema,
  text: z.string().trim().min(1).max(10_000),
  parent: objectIdSchema.nullable().optional(),
  isInternal: z.boolean().default(false),
  mentions: z.array(objectIdSchema).max(50).default([]),
  attachments: z.array(commentAttachmentSchema).max(10).default([]),
  fileIds: z.array(objectIdSchema).max(20).default([]),
});

export const updateCommentSchema = z.object({
  text: z.string().trim().min(1).max(10_000),
});

export const commentIdParamSchema = z.object({
  id: objectIdSchema,
});

export const toggleReactionSchema = z.object({
  emoji: z.string().trim().min(1).max(16),
});

export type ListCommentsQuery = z.infer<typeof listCommentsQuerySchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
export type ToggleReactionInput = z.infer<typeof toggleReactionSchema>;
export type CommentAttachmentInput = z.infer<typeof commentAttachmentSchema>;
