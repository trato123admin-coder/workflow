import { z } from 'zod';

export const baseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).optional(),
});

export const baseEngineEnvSchema = baseEnvSchema.extend({
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default('0.0.0.0'),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  ENGINE_ALLOWED_ORIGINS: z.string().default('*'),
  LIBREOFFICE_BIN: z.string().default(''),
  LIBREOFFICE_TIMEOUT_MS: z.coerce.number().default(60_000),
  LIBREOFFICE_MAX_CONCURRENT: z.coerce.number().default(1),
  ENGINE_TICK_SECRET: z.string().default('dev_tick_secret_placeholder'),
});

export const engineEnvSchema = baseEngineEnvSchema.superRefine((data, ctx) => {
  const isDevOrTest = data.NODE_ENV === 'development' || data.NODE_ENV === 'test';
  if (!isDevOrTest) {
    const secret = data.ENGINE_TICK_SECRET;
    if (!secret || secret === 'dev_tick_secret_placeholder' || secret.length < 32) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ENGINE_TICK_SECRET'],
        message:
          'ENGINE_TICK_SECRET es obligatorio en producción, debe tener al menos 32 caracteres y no puede ser el valor por defecto',
      });
    }
  }
});

export type EngineEnv = z.infer<typeof baseEngineEnvSchema>;
