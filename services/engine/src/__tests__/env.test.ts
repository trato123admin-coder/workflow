import { describe, it, expect } from 'vitest';
import { getEngineEnv } from '../config/env.js';

describe('Engine Env Loader', () => {
  it('loads environment and returns valid configuration', () => {
    const env = getEngineEnv();
    expect(env.PORT).toBeDefined();
    expect(typeof env.PORT).toBe('number');
    expect(env.HOST).toBeDefined();
  });
});
