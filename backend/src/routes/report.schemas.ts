import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');

export const reportQuerySchema = z.object({
  projectId: objectIdSchema.optional(),
});

export type ReportQuery = z.infer<typeof reportQuerySchema>;
