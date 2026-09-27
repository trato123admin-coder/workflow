import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { engineEnvSchema, type EngineEnv } from '@workflow/shared';

let envLoaded = false;

function loadLocalEnv(): void {
  if (envLoaded || typeof process.loadEnvFile !== 'function') {
    return;
  }
  envLoaded = true;

  const engineDir = fileURLToPath(new URL('../..', import.meta.url));
  const rootDir = fileURLToPath(new URL('../../..', import.meta.url));

  const candidatePaths = [
    resolve(engineDir, '.env'),
    resolve(engineDir, '.env.local'),
    resolve(rootDir, '.env.local'),
    resolve(rootDir, '.env'),
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '.env.local'),
  ];

  for (const candidate of candidatePaths) {
    if (existsSync(candidate)) {
      try {
        process.loadEnvFile(candidate);
      } catch {
        // Ignorar errores de carga si el archivo no se puede parsear
      }
    }
  }
}

export function getEngineEnv(): EngineEnv {
  loadLocalEnv();
  const result = engineEnvSchema.safeParse(process.env);
  if (!result.success) {
    const errors = result.error.format();
    throw new Error(`Engine environment validation failed: ${JSON.stringify(errors)}`);
  }
  return result.data;
}
