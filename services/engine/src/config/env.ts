import { engineEnvSchema, type EngineEnv } from '@workflow/shared';

export function getEngineEnv(): EngineEnv {
  const result = engineEnvSchema.safeParse(process.env);
  if (!result.success) {
    const errors = result.error.format();
    throw new Error(`Engine environment validation failed: ${JSON.stringify(errors)}`);
  }
  return result.data;
}
