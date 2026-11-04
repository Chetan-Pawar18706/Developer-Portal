import { z } from 'zod';
import {
  PROJECT_HEALTHS,
  PROJECT_PRIORITIES,
  PROJECT_STATUSES,
} from '../models/project.model';
import { userRoleSchema } from './user.schemas';

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');
const dateSchema = z.coerce.date().nullable().optional();

const projectMemberInputSchema = z.object({
  userId: objectIdSchema,
  role: userRoleSchema.default('developer'),
});

export const projectIdParamSchema = z.object({
  id: objectIdSchema,
});

export const projectMemberParamSchema = z.object({
  id: objectIdSchema,
  userId: objectIdSchema,
});

export const createProjectSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(5000),
  clientId: objectIdSchema.optional(),
  priority: z.enum(PROJECT_PRIORITIES).default('medium'),
  members: z.array(projectMemberInputSchema).max(100).default([]),
  startDate: dateSchema,
  dueDate: dateSchema,
  tags: z.array(z.string().trim().min(1).max(30)).max(20).default([]),
  budget: z.number().min(0).max(1_000_000_000).default(0),
});

export const updateProjectSchema = z
  .object({
    title: z.string().trim().min(3).max(120).optional(),
    description: z.string().trim().min(10).max(5000).optional(),
    priority: z.enum(PROJECT_PRIORITIES).optional(),
    startDate: dateSchema,
    dueDate: dateSchema,
    tags: z.array(z.string().trim().min(1).max(30)).max(20).optional(),
    budget: z.number().min(0).max(1_000_000_000).optional(),
    health: z.enum(PROJECT_HEALTHS).optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'At least one project field is required',
  });

export const listProjectsQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
  priority: z.enum(PROJECT_PRIORITIES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(12),
  sortBy: z
    .enum(['createdAt', 'updatedAt', 'dueDate', 'title', 'priority', 'status'])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const addProjectMemberSchema = z.object({
  userId: objectIdSchema,
  role: userRoleSchema.default('developer'),
});

export const updateProjectStatusSchema = z.object({
  status: z.enum(PROJECT_STATUSES),
  note: z.string().trim().max(1000).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  feedback: z.string().trim().max(2000).optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;
export type AddProjectMemberInput = z.infer<typeof addProjectMemberSchema>;
export type UpdateProjectStatusInput = z.infer<typeof updateProjectStatusSchema>;
