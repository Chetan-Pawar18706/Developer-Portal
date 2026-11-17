import { z } from 'zod';
import {
  TASK_CLIENT_REVIEW_STATUSES,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from '../models/task.model';

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');
const nullableObjectIdSchema = objectIdSchema.nullable().optional();
const nullableDateSchema = z.union([z.null(), z.coerce.date()]).optional();

const labelSchema = z.string().trim().min(1).max(40);

export const taskSubtaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  done: z.boolean().default(false),
});

export const taskIdParamSchema = z.object({
  id: objectIdSchema,
});

export const listTasksQuerySchema = z
  .object({
    search: z.string().trim().max(200).optional(),
    assignee: objectIdSchema.optional(),
    label: z.string().trim().max(40).optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    status: z.enum(TASK_STATUSES).optional(),
    requirementId: objectIdSchema.optional(),
    dueFrom: z.coerce.date().optional(),
    dueTo: z.coerce.date().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(200).default(50),
    sortBy: z
      .enum(['order', 'createdAt', 'updatedAt', 'dueDate', 'title', 'priority', 'status'])
      .default('order'),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
  })
  .refine(
    (value) =>
      !value.dueFrom || !value.dueTo || value.dueFrom.getTime() <= value.dueTo.getTime(),
    {
      message: 'The due range start must be before the end',
      path: ['dueFrom'],
    },
  );

export const createTaskSchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(20_000).default(''),
  requirementId: nullableObjectIdSchema,
  assigneeId: nullableObjectIdSchema,
  priority: z.enum(TASK_PRIORITIES).default('medium'),
  estimateHours: z.number().min(0).max(10_000).default(0),
  dueDate: nullableDateSchema,
  labels: z.array(labelSchema).max(20).default([]),
  subtasks: z.array(taskSubtaskSchema).max(100).default([]),
});

export const updateTaskSchema = z
  .object({
    title: z.string().trim().min(3).max(160).optional(),
    description: z.string().trim().max(20_000).optional(),
    requirementId: nullableObjectIdSchema,
    assigneeId: nullableObjectIdSchema,
    priority: z.enum(TASK_PRIORITIES).optional(),
    status: z.enum(TASK_STATUSES).optional(),
    estimateHours: z.number().min(0).max(10_000).optional(),
    dueDate: nullableDateSchema,
    labels: z.array(labelSchema).max(20).optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'At least one task field is required',
  });

export const moveTaskSchema = z.object({
  status: z.enum(TASK_STATUSES),
  order: z.number().int().min(0),
});

export const addTimeLogSchema = z.object({
  hours: z.number().min(0.25).max(24),
  note: z.string().trim().max(1000).default(''),
  date: z.coerce.date().optional(),
});

export const updateSubtasksSchema = z.object({
  subtasks: z.array(taskSubtaskSchema).max(100),
});

export const clientReviewSchema = z
  .object({
    status: z.enum(['approved', 'changes_requested']),
    note: z.string().trim().max(2000).default(''),
  })
  .refine(
    (value) => value.status !== 'changes_requested' || value.note.trim().length > 0,
    {
      message: 'A note is required when requesting changes',
      path: ['note'],
    },
  );

export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type MoveTaskInput = z.infer<typeof moveTaskSchema>;
export type AddTimeLogInput = z.infer<typeof addTimeLogSchema>;
export type UpdateSubtasksInput = z.infer<typeof updateSubtasksSchema>;
export type ClientReviewInput = z.infer<typeof clientReviewSchema>;
export type TaskSubtaskInput = z.infer<typeof taskSubtaskSchema>;
export type TaskClientReviewStatusInput = (typeof TASK_CLIENT_REVIEW_STATUSES)[number];
