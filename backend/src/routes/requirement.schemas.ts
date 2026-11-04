import { z } from 'zod';
import {
  REQUIREMENT_PRIORITIES,
  REQUIREMENT_STATUSES,
  REQUIREMENT_TYPES,
} from '../models/requirement.model';

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');

const acceptanceCriteriaSchema = z
  .array(z.string().trim().min(1, 'Acceptance criteria cannot be empty').max(500))
  .max(40)
  .default([]);

const attachmentInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  url: z.string().trim().url('Attachment URL must be valid').max(2000),
  mimeType: z.string().trim().max(120).default('application/octet-stream'),
  size: z.number().int().min(0).default(0),
});

export const requirementIdParamSchema = z.object({
  id: objectIdSchema,
});

export const projectRequirementParamSchema = z.object({
  id: objectIdSchema,
});

export const listRequirementsQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  status: z.enum(REQUIREMENT_STATUSES).optional(),
  priority: z.enum(REQUIREMENT_PRIORITIES).optional(),
  type: z.enum(REQUIREMENT_TYPES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z
    .enum(['createdAt', 'updatedAt', 'title', 'priority', 'status'])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const createRequirementSchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(1).max(20_000),
  acceptanceCriteria: acceptanceCriteriaSchema,
  priority: z.enum(REQUIREMENT_PRIORITIES).default('should'),
  type: z.enum(REQUIREMENT_TYPES).default('functional'),
  attachments: z.array(attachmentInputSchema).max(20).default([]),
});

export const updateRequirementSchema = z
  .object({
    title: z.string().trim().min(3).max(160).optional(),
    description: z.string().trim().min(1).max(20_000).optional(),
    acceptanceCriteria: acceptanceCriteriaSchema.optional(),
    priority: z.enum(REQUIREMENT_PRIORITIES).optional(),
    type: z.enum(REQUIREMENT_TYPES).optional(),
    attachments: z.array(attachmentInputSchema).max(20).optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'At least one requirement field is required',
  });

export const updateRequirementStatusSchema = z.object({
  status: z.enum(REQUIREMENT_STATUSES),
  note: z.string().trim().max(2000).optional(),
});

export const createChangeRequestSchema = z.object({
  title: z.string().trim().min(3).max(160).optional(),
  description: z.string().trim().min(1).max(20_000).optional(),
  acceptanceCriteria: acceptanceCriteriaSchema.optional(),
  priority: z.enum(REQUIREMENT_PRIORITIES).optional(),
  type: z.enum(REQUIREMENT_TYPES).optional(),
});

export type ListRequirementsQuery = z.infer<typeof listRequirementsQuerySchema>;
export type CreateRequirementInput = z.infer<typeof createRequirementSchema>;
export type UpdateRequirementInput = z.infer<typeof updateRequirementSchema>;
export type UpdateRequirementStatusInput = z.infer<typeof updateRequirementStatusSchema>;
export type CreateChangeRequestInput = z.infer<typeof createChangeRequestSchema>;
