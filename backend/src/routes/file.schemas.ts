import { z } from 'zod';
import { FILE_FOLDERS } from '../models/file.model';

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');

const multipartBoolean = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((value) => value === true || value === 'true');

export const fileIdParamSchema = z.object({
  id: objectIdSchema,
});

export const listFilesQuerySchema = z.object({
  folder: z.enum(FILE_FOLDERS).optional(),
  search: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  sortBy: z.enum(['createdAt', 'updatedAt', 'name', 'size']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const createFilesBodySchema = z.object({
  folder: z.enum(FILE_FOLDERS).default('other'),
  isInternal: multipartBoolean.default(false),
});

export const newVersionBodySchema = z.object({
  note: z.string().trim().max(2000).default(''),
});

export type ListFilesQuery = z.infer<typeof listFilesQuerySchema>;
export type CreateFilesBody = z.infer<typeof createFilesBodySchema>;
export type NewVersionBody = z.infer<typeof newVersionBodySchema>;
