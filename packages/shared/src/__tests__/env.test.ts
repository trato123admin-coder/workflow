import { describe, it, expect } from 'vitest';
import { engineEnvSchema } from '../env.js';
import { APP_DEFAULTS } from '../constants.js';

describe('Shared Package Defaults & Schemas', () => {
  it('should have standard default values', () => {
    expect(APP_DEFAULTS.TIMEZONE).toBe('America/Lima');
    expect(APP_DEFAULTS.CURRENCY).toBe('PEN');
    expect(APP_DEFAULTS.LOCALE).toBe('es-PE');
  });

  it('[unitaria] should validate engine env with dev defaults', () => {
    const parsed = engineEnvSchema.parse({ NODE_ENV: 'development' });
    expect(parsed.PORT).toBe(3001);
    expect(parsed.HOST).toBe('0.0.0.0');
    expect(parsed.NODE_ENV).toBe('development');
    expect(parsed.ENGINE_TICK_SECRET).toBe('dev_tick_secret_placeholder');
  });

  it('[unitaria] should treat missing NODE_ENV as production and reject placeholder secret', () => {
    expect(() => engineEnvSchema.parse({})).toThrowError(
      /ENGINE_TICK_SECRET es obligatorio en producción/,
    );
  });

  it('[unitaria] should reject production when secret is less than 32 characters', () => {
    expect(() =>
      engineEnvSchema.parse({
        NODE_ENV: 'production',
        ENGINE_TICK_SECRET: 'short_secret_below_32_chars',
      }),
    ).toThrowError(/ENGINE_TICK_SECRET es obligatorio en producción/);
  });

  it('[unitaria] should accept valid production secret of 32+ characters', () => {
    const parsed = engineEnvSchema.parse({
      NODE_ENV: 'production',
      ENGINE_TICK_SECRET: 'a_very_secure_random_engine_tick_secret_32_chars_long',
    });
    expect(parsed.NODE_ENV).toBe('production');
  });

  it('[unitaria] should reject invalid NODE_ENV', () => {
    expect(() =>
      engineEnvSchema.parse({
        NODE_ENV: 'invalid_env',
      }),
    ).toThrow();
  });
});
