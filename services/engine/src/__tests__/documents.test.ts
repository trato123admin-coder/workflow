import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildApp } from '../app.js';
import { setStorageProvider, setSupabaseServiceClient } from '../storage/index.js';
import type { StorageProvider } from '../storage/provider.js';

describe('Engine Document Routes - Upload & Download (S5-05, S5-10)', () => {
  let app: FastifyInstance;
  let mockStorage: StorageProvider;
  let mockSupabase: SupabaseClient;
  let auditLogsInsertMock: ReturnType<typeof vi.fn>;

  const validDocId = '22222222-2222-2222-2222-222222222222';
  const validCaseId = '33333333-3333-3333-3333-333333333333';
  const validUserId = '44444444-4444-4444-4444-444444444444';
  const validVersionId = '55555555-5555-5555-5555-555555555555';

  let systemSettingsData: Array<{ key: string; value: unknown }>;
  let caseAssignmentsData: Array<{ assignment_type: string }>;
  let isCaseConfidential: boolean;
  let isUserSuperuser: boolean;
  let userPermissions: string[];
  let isProfileActive: boolean;
  let roleRequiresMfa: boolean;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  }, 30000);

  beforeEach(() => {
    isProfileActive = true;
    roleRequiresMfa = false;
    systemSettingsData = [
      { key: 'storage.max_file_mb', value: 10 },
      {
        key: 'storage.allowed_mime',
        value: [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'image/jpeg',
          'image/png',
        ],
      },
    ];
    caseAssignmentsData = [{ assignment_type: 'RESPONSIBLE' }];
    isCaseConfidential = false;
    isUserSuperuser = true;
    userPermissions = ['documents.upload', 'documents.read', 'cases.write.all', 'cases.read.all'];

    auditLogsInsertMock = vi.fn().mockResolvedValue({ error: null });

    mockStorage = {
      code: 'supabase',
      put: vi.fn().mockResolvedValue(undefined),
      get: vi.fn(),
      delete: vi.fn().mockResolvedValue(undefined),
      exists: vi.fn().mockResolvedValue(false),
      signedUrl: vi.fn().mockResolvedValue('https://signed.url/v1/download?token=signed60s'),
      healthCheck: vi.fn().mockResolvedValue(true),
    };
    setStorageProvider(mockStorage);

    mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: validUserId, email: 'abogado@test.pe' } },
          error: null,
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { is_active: isProfileActive },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'system_settings') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: systemSettingsData, error: null }),
            }),
          };
        }
        if (table === 'case_assignments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  is: vi.fn().mockResolvedValue({ data: caseAssignmentsData, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === 'case_documents') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockImplementation(() =>
                  Promise.resolve({
                    data: {
                      id: validDocId,
                      case_id: validCaseId,
                      is_active: true,
                      status: 'PENDING',
                      cases: { id: validCaseId, is_confidential: isCaseConfidential, status: 'OPEN' },
                    },
                    error: null,
                  })
                ),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
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
                      code: 'ADMIN',
                      is_superuser: isUserSuperuser,
                      is_active: true,
                      requires_mfa: roleRequiresMfa,
                      role_permissions: userPermissions.map((code) => ({
                        permissions: { code },
                      })),
                    },
                  },
                ],
                error: null,
              }),
            }),
          };
        }
        if (table === 'document_versions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn((col: string, val: string) => {
                if (col === 'id') {
                  return {
                    maybeSingle: vi.fn().mockResolvedValue({
                      data:
                        val === '99999999-9999-9999-9999-999999999999'
                          ? null
                          : {
                              id: validVersionId,
                              version: 1,
                              storage_backend: 'supabase',
                              storage_key: 'case-333/doc-222/v1/partida.pdf',
                              file_name: 'partida.pdf',
                              size_bytes: 1048576,
                              mime_type: 'application/pdf',
                              sha256: 'a'.repeat(64),
                              case_documents: {
                                id: validDocId,
                                case_id: validCaseId,
                                is_active: true,
                                cases: {
                                  id: validCaseId,
                                  is_confidential: false,
                                  status: 'OPEN',
                                },
                              },
                            },
                      error: null,
                    }),
                  };
                }
                return {
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({ data: [] }),
                  }),
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: null }),
                  }),
                };
              }),
            }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: validVersionId,
                    version: 1,
                    created_at: new Date().toISOString(),
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'audit_logs') {
          return {
            insert: auditLogsInsertMock,
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }),
    } as unknown as SupabaseClient;

    setSupabaseServiceClient(mockSupabase);
  });

  afterAll(async () => {
    await app.close();
    setStorageProvider(null);
    setSupabaseServiceClient(null);
  });

  function createMultipartPayload(boundary: string, filename: string, mime: string, content: Buffer): Buffer {
    const header = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`
    );
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
    return Buffer.concat([header, content, footer]);
  }

  // ============================================================================
  // PRUEBAS DE SUBIDA (S5-10)
  // ============================================================================
  it('rechaza subida si el ID del documento no es un UUID válido (HTTP 400)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/documents/case-documents/not-a-uuid/versions',
      headers: { authorization: 'Bearer valid-jwt-token' },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('INVALID_PARAMS');
  });

  it('rechaza subida sin encabezado Authorization Bearer (HTTP 401)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/v1/documents/case-documents/${validDocId}/versions`,
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('UNAUTHORIZED');
  });

  it('rechaza subida si la petición no es multipart (HTTP 400)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/v1/documents/case-documents/${validDocId}/versions`,
      headers: {
        authorization: 'Bearer valid-jwt-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ foo: 'bar' }),
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('INVALID_CONTENT_TYPE');
  });

  it('valida tipo MIME contra system_settings y rechaza tipos no permitidos (HTTP 415)', async () => {
    const boundary = '----Boundary123';
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="test.txt"',
      'Content-Type: text/plain',
      '',
      'Plain text content',
      `--${boundary}--`,
      '',
    ].join('\r\n');

    const response = await app.inject({
      method: 'POST',
      url: `/v1/documents/case-documents/${validDocId}/versions`,
      headers: {
        authorization: 'Bearer valid-jwt-token',
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });

    expect(response.statusCode).toBe(415);
    const resBody = JSON.parse(response.body);
    expect(resBody.error).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('valida magic bytes y rechaza contenido que no coincide con MIME (HTTP 400)', async () => {
    const boundary = '----Boundary123';
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="falso.pdf"',
      'Content-Type: application/pdf',
      '',
      'ESTO NO ES UN PDF REAL SINO TEXTO',
      `--${boundary}--`,
      '',
    ].join('\r\n');

    const response = await app.inject({
      method: 'POST',
      url: `/v1/documents/case-documents/${validDocId}/versions`,
      headers: {
        authorization: 'Bearer valid-jwt-token',
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });

    expect(response.statusCode).toBe(400);
    const resBody = JSON.parse(response.body);
    expect(resBody.error).toBe('INVALID_FILE_SIGNATURE');
  });

  it('aplica el límite de tamaño dinámico desde system_settings.storage.max_file_mb y rechaza si excede (HTTP 413)', async () => {
    // Configura tope dinámico a 1 MB
    systemSettingsData = [
      { key: 'storage.max_file_mb', value: 1 },
      { key: 'storage.allowed_mime', value: ['application/pdf'] },
    ];

    const boundary = '----BoundaryLarge';
    // Crea un archivo PDF válido de 2 MB (excede el límite de 1 MB)
    const headerPdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n');
    const filler = Buffer.alloc(2 * 1024 * 1024);
    const trailerPdf = Buffer.from('\ntrailer\n<<>>\n%%EOF');
    const fileBytes = Buffer.concat([headerPdf, filler, trailerPdf]);
    const payload = createMultipartPayload(boundary, 'grande.pdf', 'application/pdf', fileBytes);

    const response = await app.inject({
      method: 'POST',
      url: `/v1/documents/case-documents/${validDocId}/versions`,
      headers: {
        authorization: 'Bearer valid-jwt-token',
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      body: payload,
    });

    expect(response.statusCode).toBe(413);
    const resBody = JSON.parse(response.body);
    expect(resBody.error).toBe('FILE_TOO_LARGE');
    expect(resBody.message).toContain('1 MB');
  });

  it('aplica la lista blanca dinámica de tipos MIME desde system_settings.storage.allowed_mime (HTTP 415)', async () => {
    // Configura solo PDF como permitido
    systemSettingsData = [
      { key: 'storage.max_file_mb', value: 10 },
      { key: 'storage.allowed_mime', value: ['application/pdf'] },
    ];

    const boundary = '----BoundaryPngRestricted';
    // PNG con magic bytes válidos \x89PNG\r\n\x1a\n
    const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00]);
    const payload = createMultipartPayload(boundary, 'foto.png', 'image/png', pngBytes);

    const response = await app.inject({
      method: 'POST',
      url: `/v1/documents/case-documents/${validDocId}/versions`,
      headers: {
        authorization: 'Bearer valid-jwt-token',
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      body: payload,
    });

    expect(response.statusCode).toBe(415);
    const resBody = JSON.parse(response.body);
    expect(resBody.error).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('bloquea subida si el usuario tiene asignación exclusiva VIEWER (HTTP 403)', async () => {
    isUserSuperuser = false;
    caseAssignmentsData = [{ assignment_type: 'VIEWER' }];

    const boundary = '----BoundaryViewer';
    const pdfBytes = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
    const payload = createMultipartPayload(boundary, 'partida.pdf', 'application/pdf', pdfBytes);

    const response = await app.inject({
      method: 'POST',
      url: `/v1/documents/case-documents/${validDocId}/versions`,
      headers: {
        authorization: 'Bearer valid-jwt-token',
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      body: payload,
    });

    expect(response.statusCode).toBe(403);
    const resBody = JSON.parse(response.body);
    expect(resBody.error).toBe('FORBIDDEN_CASE_WRITE');
  });

  it('bloquea subida si el caso es confidencial y el usuario no está asignado (HTTP 403)', async () => {
    isUserSuperuser = false;
    isCaseConfidential = true;
    caseAssignmentsData = []; // No asignado

    const boundary = '----BoundaryConfidential';
    const pdfBytes = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
    const payload = createMultipartPayload(boundary, 'partida.pdf', 'application/pdf', pdfBytes);

    const response = await app.inject({
      method: 'POST',
      url: `/v1/documents/case-documents/${validDocId}/versions`,
      headers: {
        authorization: 'Bearer valid-jwt-token',
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      body: payload,
    });

    expect(response.statusCode).toBe(403);
    const resBody = JSON.parse(response.body);
    expect(resBody.error).toBe('FORBIDDEN_CONFIDENTIAL_CASE');
  });

  it('bloquea subida si profiles.is_active es false (HTTP 403 FORBIDDEN_USER_INACTIVE)', async () => {
    isProfileActive = false;

    const boundary = '----BoundaryInactiveProfile';
    const pdfBytes = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
    const payload = createMultipartPayload(boundary, 'partida.pdf', 'application/pdf', pdfBytes);

    const response = await app.inject({
      method: 'POST',
      url: `/v1/documents/case-documents/${validDocId}/versions`,
      headers: {
        authorization: 'Bearer valid-jwt-token',
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      body: payload,
    });

    expect(response.statusCode).toBe(403);
    const resBody = JSON.parse(response.body);
    expect(resBody.error).toBe('FORBIDDEN_USER_INACTIVE');
  });

  it('bloquea subida si el rol exige MFA y la sesión está en aal1 (HTTP 403 FORBIDDEN_MFA_REQUIRED)', async () => {
    roleRequiresMfa = true;
    const aal1Payload = Buffer.from(JSON.stringify({ aal: 'aal1', sub: validUserId })).toString('base64');
    const aal1Token = `header.${aal1Payload}.signature`;

    const boundary = '----BoundaryMfaRequired';
    const pdfBytes = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
    const payload = createMultipartPayload(boundary, 'partida.pdf', 'application/pdf', pdfBytes);

    const response = await app.inject({
      method: 'POST',
      url: `/v1/documents/case-documents/${validDocId}/versions`,
      headers: {
        authorization: `Bearer ${aal1Token}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      body: payload,
    });

    expect(response.statusCode).toBe(403);
    const resBody = JSON.parse(response.body);
    expect(resBody.error).toBe('FORBIDDEN_MFA_REQUIRED');
  });

  it('permite subida si el rol exige MFA y la sesión está en aal2 (HTTP 201)', async () => {
    roleRequiresMfa = true;
    const aal2Payload = Buffer.from(JSON.stringify({ aal: 'aal2', sub: validUserId })).toString('base64');
    const aal2Token = `header.${aal2Payload}.signature`;

    const boundary = '----BoundaryMfaSuccess';
    const pdfBytes = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
    const payload = createMultipartPayload(boundary, 'partida.pdf', 'application/pdf', pdfBytes);

    const response = await app.inject({
      method: 'POST',
      url: `/v1/documents/case-documents/${validDocId}/versions`,
      headers: {
        authorization: `Bearer ${aal2Token}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      body: payload,
    });

    expect(response.statusCode).toBe(201);
    const resBody = JSON.parse(response.body);
    expect(resBody.success).toBe(true);
  });

  it('procesa subida exitosa con service_role cuando las credenciales son válidas (HTTP 201)', async () => {
    const boundary = '----BoundaryMockTest';
    const pdfBytes = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
    const payload = createMultipartPayload(boundary, 'partida.pdf', 'application/pdf', pdfBytes);

    const response = await app.inject({
      method: 'POST',
      url: `/v1/documents/case-documents/${validDocId}/versions`,
      headers: {
        authorization: 'Bearer valid-jwt-token',
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      body: payload,
    });

    expect(response.statusCode).toBe(201);
    const resBody = JSON.parse(response.body);
    expect(resBody.success).toBe(true);
    expect(resBody.data.version_id).toBe(validVersionId);
    expect(resBody.data.version_number).toBe(1);
    expect(resBody.data.status).toBe('UPLOADED');
    expect(resBody.data.sha256).toHaveLength(64);
    expect(mockStorage.put).toHaveBeenCalled();
    expect(auditLogsInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'UPLOAD_DOCUMENT' })
    );
  });

  // ============================================================================
  // PRUEBAS DE DESCARGA AUDITADA (S5-05)
  // ============================================================================
  it('rechaza descarga si el ID de versión no es un UUID válido (HTTP 400)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/downloads/invalid-uuid',
      headers: { authorization: 'Bearer valid-jwt-token' },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('INVALID_PARAMS');
  });

  it('rechaza descarga sin encabezado Authorization Bearer (HTTP 401)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/v1/downloads/${validVersionId}`,
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('UNAUTHORIZED');
  });

  it('retorna 404 si la versión solicitada no existe', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/downloads/99999999-9999-9999-9999-999999999999',
      headers: { authorization: 'Bearer valid-jwt-token' },
    });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('VERSION_NOT_FOUND');
  });

  it('genera URL firmada de 60 segundos y registra evento DOWNLOAD_DOCUMENT en audit_logs (HTTP 200)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/v1/downloads/${validVersionId}`,
      headers: {
        authorization: 'Bearer valid-jwt-token',
        'user-agent': 'Vitest-Agent/1.0',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.download_url).toBe('https://signed.url/v1/download?token=signed60s');
    expect(body.data.expires_in).toBe(60);
    expect(body.data.file_name).toBe('partida.pdf');
    expect(body.data.mime_type).toBe('application/pdf');
    expect(body.data.size_bytes).toBe(1048576);

    expect(mockStorage.signedUrl).toHaveBeenCalledWith(
      'case-333/doc-222/v1/partida.pdf',
      60
    );

    expect(auditLogsInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DOWNLOAD_DOCUMENT',
        entity_id: validVersionId,
        entity_type: 'document_version',
        module: 'documents',
        user_id: validUserId,
        new_data: expect.objectContaining({
          case_id: validCaseId,
          version: 1,
          ttl_seconds: 60,
        }),
      })
    );
  });
});
