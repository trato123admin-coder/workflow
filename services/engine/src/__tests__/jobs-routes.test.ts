import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildApp } from '../app.js';
import { setSupabaseServiceClient } from '../storage/index.js';
import { safeCompareTokens } from '../routes/jobs.js';

describe('Engine: Jobs Routes [mock] (S8-01, S8-07)', () => {
  let app: FastifyInstance;

  const validTickSecret = 'dev_tick_secret_placeholder';
  const adminUserId = '11111111-1111-1111-1111-111111111111';

  beforeAll(async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockImplementation(async (jwt: string) => {
          if (jwt === 'valid-admin-jwt') {
            return { data: { user: { id: adminUserId, email: 'admin@example.com' } }, error: null };
          }
          return { data: { user: null }, error: new Error('Token inválido') };
        }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: adminUserId, is_active: true },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'user_roles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  {
                    roles: {
                      id: 'role-1',
                      is_active: true,
                      is_superuser: false,
                      requires_mfa: false,
                      role_permissions: [{ permissions: { code: 'settings.manage' } }],
                    },
                  },
                ],
                error: null,
              }),
            }),
          };
        }
        if (table === 'system_settings') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      }),
      rpc: vi.fn().mockImplementation(async (fnName: string) => {
        if (fnName === 'claim_jobs') return { data: [], error: null };
        return { data: null, error: null };
      }),
    } as unknown as SupabaseClient;

    setSupabaseServiceClient(mockSupabase);
    app = await buildApp();
    await app.ready();
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('[unitaria] safeCompareTokens compara cadenas de forma segura y en tiempo constante', () => {
    expect(safeCompareTokens('super-secret-1234', 'super-secret-1234')).toBe(true);
    expect(safeCompareTokens('super-secret-1234', 'super-secret-1235')).toBe(false);
    expect(safeCompareTokens('short', 'much-longer-string')).toBe(false);
    expect(safeCompareTokens('', 'secret')).toBe(false);
    expect(safeCompareTokens('secret', '')).toBe(false);
  });

  it('[mock] POST /v1/jobs/tick responde 200 cuando se autentica con Bearer ENGINE_TICK_SECRET', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/jobs/tick',
      headers: {
        authorization: `Bearer ${validTickSecret}`,
      },
      payload: { source: 'cron_test' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.processed).toBeDefined();
  });

  it('[mock] POST /v1/jobs/tick responde 200 cuando se autentica con JWT y permiso settings.manage', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/jobs/tick',
      headers: {
        authorization: 'Bearer valid-admin-jwt',
      },
      payload: { source: 'ui_test' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
  });

  it('[mock] POST /v1/jobs/tick responde 401 cuando no se provee token o es inválido', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/jobs/tick',
      headers: {
        authorization: 'Bearer token-invalido',
      },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('UNAUTHORIZED');
  });

  it('[mock] GET /v1/jobs responde 404 porque la ruta fue eliminada del engine', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/jobs',
      headers: {
        authorization: `Bearer ${validTickSecret}`,
      },
    });

    expect(res.statusCode).toBe(404);
  });

  it('[mock] POST /v1/jobs/:id/retry responde 404 porque la ruta fue eliminada del engine', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/jobs/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/retry',
      headers: {
        authorization: `Bearer ${validTickSecret}`,
      },
    });

    expect(res.statusCode).toBe(404);
  });
});
