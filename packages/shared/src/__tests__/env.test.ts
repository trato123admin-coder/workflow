import { describe, it, expect } from 'vitest';
import { engineEnvSchema } from '../env.js';
import { APP_DEFAULTS } from '../constants.js';

describe('Shared Package Defaults & Schemas', () => {
  it('should have standard default values', () => {
    expect(APP_DEFAULTS.TIMEZONE).toBe('America/Lima');
    expect(APP_DEFAULTS.CURRENCY).toBe('PEN');
    expect(APP_DEFAULTS.LOCALE).toBe('es-PE');
  });

  it('should validate engine env with defaults', () => {
    const parsed = engineEnvSchema.parse({});
    expect(parsed.PORT).toBe(3001);
    expect(parsed.HOST).toBe('0.0.0.0');
    expect(parsed.NODE_ENV).toBe('development');
  });

  it('should reject invalid NODE_ENV', () => {
    expect(() =>
      engineEnvSchema.parse({
        NODE_ENV: 'invalid_env',
      }),
    ).toThrow();
  });
});
