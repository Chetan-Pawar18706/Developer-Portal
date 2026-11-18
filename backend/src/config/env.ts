import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  CLIENT_URL: z.string().url('CLIENT_URL must be a valid URL'),
  MAIL_PROVIDER: z.enum(['smtp', 'ethereal']).default('smtp'),
  SMTP_HOST: z.string().min(1).default('smtp.example.com'),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().min(1).default('your-smtp-user'),
  SMTP_PASS: z.string().min(1).default('your-smtp-password'),
  SMTP_FROM: z
    .string()
    .min(1)
    .default('"Developer Portal" <no-reply@developer-portal.local>'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  console.error(`Invalid environment configuration:\n${details}`);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
