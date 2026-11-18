import { z } from 'zod';

export const httpAttachmentUrlSchema = z
  .string()
  .trim()
  .url('Attachment URL must be valid')
  .max(2000)
  .refine((value) => /^https?:\/\//i.test(value), {
    message: 'Attachment URL must use http or https',
  });
