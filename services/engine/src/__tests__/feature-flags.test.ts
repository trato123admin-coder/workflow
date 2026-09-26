import { describe, it, expect, beforeEach } from 'vitest';
import { buildApp } from '../app.js';
import { setFlagStatusProvider } from '../middleware/feature-flag.js';

describe('Engine: Feature Flag Middleware (S2-02)', () => {
  let flagsState: Record<string, boolean> = {
    'module.cash': true,
    'module.quotes': true,
    'module.ai': false,
  };

  beforeEach(() => {
    flagsState = {
      'module.cash': true,
      'module.quotes': true,
      'module.ai': false,
    };
    setFlagStatusProvider((key: string) => flagsState[key] ?? false);
  });

  it('permite acceso cuando el flag está activo (HTTP 200)', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/v1/cash/summary',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.module).toBe('cash');
    expect(body.status).toBe('active');
  }, 20000);

  it('responde 403 feature_disabled cuando el flag está inactivo', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/v1/ai/recommendations',
    });

    expect(response.statusCode).toBe(403);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('feature_disabled');
    expect(body.message).toContain('module.ai');
  });

  it('responde 403 feature_disabled dinámicamente si el flag se apaga', async () => {
    const app = await buildApp();

    // 1. Activo
    const res1 = await app.inject({ method: 'GET', url: '/v1/cash/summary' });
    expect(res1.statusCode).toBe(200);

    // 2. Desactivamos flag
    flagsState['module.cash'] = false;

    // 3. Bloqueado con 403
    const res2 = await app.inject({ method: 'GET', url: '/v1/cash/summary' });
    expect(res2.statusCode).toBe(403);
    const body = JSON.parse(res2.body);
    expect(body.error).toBe('feature_disabled');
  });
});
