import { z } from 'zod';
import { httpAttachmentUrlSchema } from './common.schemas';
import {
  ISSUE_SEVERITIES,
  ISSUE_STATUSES,
  ISSUE_TYPES,
} from '../models/issue.model';

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');
const nullableObjectIdSchema = objectIdSchema.nullable().optional();

const issueAttachmentSchema = z.object({
  name: z.string().trim().min(1).max(200),
  url: httpAttachmentUrlSchema,
  mimeType: z.string().trim().max(120).default(''),
  size: z.number().int().min(0).max(500_000_000).default(0),
});

export const issueIdParamSchema = z.object({
  id: objectIdSchema,
});

export const projectIssueParamSchema = z.object({
  id: objectIdSchema,
});

const listIssuesBaseSchema = z.object({
  search: z.string().trim().max(200).optional(),
  type: z.enum(ISSUE_TYPES).optional(),
  severity: z.enum(ISSUE_SEVERITIES).optional(),
  status: z.enum(ISSUE_STATUSES).optional(),
  assignedTo: objectIdSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  sortBy: z
    .enum(['createdAt', 'updatedAt', 'title', 'severity', 'status'])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const listIssuesQuerySchema = listIssuesBaseSchema;

export const listAllIssuesQuerySchema = listIssuesBaseSchema.extend({
  projectId: objectIdSchema.optional(),
});

export const createIssueSchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(10).max(20_000),
  type: z.enum(ISSUE_TYPES).default('bug'),
  severity: z.enum(ISSUE_SEVERITIES).default('medium'),
  stepsToReproduce: z.string().trim().max(10_000).default(''),
  attachments: z.array(issueAttachmentSchema).max(10).default([]),
  fileIds: z.array(objectIdSchema).max(20).default([]),
});

export const updateIssueSchema = z
  .object({
    title: z.string().trim().min(3).max(160).optional(),
    description: z.string().trim().min(10).max(20_000).optional(),
    type: z.enum(ISSUE_TYPES).optional(),
    severity: z.enum(ISSUE_SEVERITIES).optional(),
    stepsToReproduce: z.string().trim().max(10_000).optional(),
    attachments: z.array(issueAttachmentSchema).max(10).optional(),
    fileIds: z.array(objectIdSchema).max(20).optional(),
    assignedTo: nullableObjectIdSchema,
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'At least one issue field is required',
  });

export const updateIssueStatusSchema = z.object({
  status: z.enum(ISSUE_STATUSES),
  note: z.string().trim().max(2000).default(''),
});

export type ListIssuesQuery = z.infer<typeof listIssuesQuerySchema>;
export type ListAllIssuesQuery = z.infer<typeof listAllIssuesQuerySchema>;
export type CreateIssueInput = z.infer<typeof createIssueSchema>;
export type UpdateIssueInput = z.infer<typeof updateIssueSchema>;
export type UpdateIssueStatusInput = z.infer<typeof updateIssueStatusSchema>;
export type IssueAttachmentInput = z.infer<typeof issueAttachmentSchema>;
