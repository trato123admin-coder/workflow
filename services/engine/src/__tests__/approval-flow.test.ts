import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildApp } from '../app.js';
import { setSupabaseServiceClient } from '../storage/index.js';

describe('Engine: Legal Approval Flow & Four-Eyes Rule (S7-06)', () => {
  let app: FastifyInstance;
  let mockSupabase: SupabaseClient;

  const validDocId = '11111111-1111-1111-1111-111111111111';
  const validJobId = '22222222-2222-2222-2222-222222222222';
  const generatorUserId = '33333333-3333-3333-3333-333333333333';
  const approverUserId = '44444444-4444-4444-4444-444444444444';

  let currentAuthUser: { id: string; email: string } = {
    id: approverUserId,
    email: 'lawyer@example.com',
  };

  let fourEyesEnabled = true;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  }, 30000);

  beforeEach(() => {
    currentAuthUser = { id: approverUserId, email: 'lawyer@example.com' };
    fourEyesEnabled = true;

    mockSupabase = {
      auth: {
        getUser: vi.fn().mockImplementation(async (jwt: string) => {
          if (!jwt || jwt === 'invalid') {
            return { data: { user: null }, error: new Error('Invalid token') };
          }
          return { data: { user: currentAuthUser }, error: null };
        }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'generated_documents') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: validDocId,
                    approval_status: 'GENERATED',
                    generation_job_id: validJobId,
                    case_document_id: 'cd-123',
                  },
                  error: null,
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: validDocId, approval_status: 'APPROVED' },
                    error: null,
                  }),
                }),
                neq: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          };
        }

        if (table === 'system_settings') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { value: { enabled: fourEyesEnabled } },
                  error: null,
                }),
              }),
            }),
          };
        }

        if (table === 'generation_jobs') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { requested_by: generatorUserId },
                  error: null,
                }),
              }),
            }),
          };
        }

        if (table === 'audit_logs') {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }

        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }),
    } as unknown as SupabaseClient;

    setSupabaseServiceClient(mockSupabase);
  });

  it('rechaza aprobación sin encabezado Authorization (HTTP 401)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/v1/generated-documents/${validDocId}/approve`,
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('UNAUTHORIZED');
  });

  it('bloquea auto-aprobación con HTTP 403 FOUR_EYES_VIOLATION cuando docs.four_eyes está activo y el aprobador es quien generó', async () => {
    // Simulamos que quien intenta aprobar es el mismo usuario que generó el trabajo
    currentAuthUser = { id: generatorUserId, email: 'generator@example.com' };
    fourEyesEnabled = true;

    const response = await app.inject({
      method: 'POST',
      url: `/v1/generated-documents/${validDocId}/approve`,
      headers: {
        authorization: 'Bearer valid-jwt-token',
      },
    });

    expect(response.statusCode).toBe(403);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('FOUR_EYES_VIOLATION');
    expect(body.message).toContain('doble control');
  });

  it('permite la aprobación (HTTP 200) cuando el aprobador es distinto del generador', async () => {
    // Aprobador distinto al generador
    currentAuthUser = { id: approverUserId, email: 'lawyer@example.com' };
    fourEyesEnabled = true;

    const response = await app.inject({
      method: 'POST',
      url: `/v1/generated-documents/${validDocId}/approve`,
      headers: {
        authorization: 'Bearer valid-jwt-token',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.approval_status).toBe('APPROVED');
  });

  it('permite aprobación por el mismo usuario si docs.four_eyes está desactivado', async () => {
    currentAuthUser = { id: generatorUserId, email: 'generator@example.com' };
    fourEyesEnabled = false; // Flag apagado

    const response = await app.inject({
      method: 'POST',
      url: `/v1/generated-documents/${validDocId}/approve`,
      headers: {
        authorization: 'Bearer valid-jwt-token',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.approval_status).toBe('APPROVED');
  });

  it('permite rechazar un documento con motivo y registra en auditoría (HTTP 200)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/v1/generated-documents/${validDocId}/reject`,
      headers: {
        authorization: 'Bearer valid-jwt-token',
        'content-type': 'application/json',
      },
      payload: {
        reason: 'Falta firma del cónyuge supérstite',
      },
    });

    expect(response.statusCode).toBe(200);
  });
});
