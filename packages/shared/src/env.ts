import { z } from 'zod';

export const baseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export const engineEnvSchema = baseEnvSchema.extend({
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default('0.0.0.0'),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  ENGINE_ALLOWED_ORIGINS: z.string().default('*'),
  LIBREOFFICE_BIN: z.string().default(''),
  LIBREOFFICE_TIMEOUT_MS: z.coerce.number().default(60_000),
  LIBREOFFICE_MAX_CONCURRENT: z.coerce.number().default(1),
});

export type EngineEnv = z.infer<typeof engineEnvSchema>;
