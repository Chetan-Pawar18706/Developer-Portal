import { z } from 'zod';

export const httpAttachmentUrlSchema = z
  .string()
  .trim()
  .url('Attachment URL must be valid')
  .max(2000)
  .refine((value) => /^https?:\/\//i.test(value), {
    message: 'Attachment URL must use http or https',
  });

export const avatarUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (value) =>
      /^https?:\/\//i.test(value) || /^\/api\/users\/[a-f\d]{24}\/avatar$/i.test(value),
    { message: 'Avatar must use http, https or the uploaded avatar path' },
  );

const socialHandlePattern = /^[A-Za-z0-9._-]{1,100}$/;

export const socialProfileSchema = z
  .string()
  .trim()
  .max(200)
  .refine(
    (value) => /^https?:\/\//i.test(value) || socialHandlePattern.test(value),
    { message: 'Enter a profile URL or a valid handle' },
  );

export const nullableTextSchema = (maxLength: number) =>
  z.string().trim().max(maxLength).nullable().optional();

export const skillsSchema = z
  .array(z.string().trim().min(1).max(40))
  .max(20)
  .transform((values) => [...new Set(values)]);
