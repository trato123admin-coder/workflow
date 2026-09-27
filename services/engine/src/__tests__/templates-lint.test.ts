import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import PizZip from 'pizzip';
import type { FastifyInstance } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildApp } from '../app.js';
import { lintDocxBuffer } from '../services/templates-service.js';
import { setTemplatesStorageProvider, setSupabaseServiceClient } from '../storage/index.js';
import type { StorageProvider } from '../storage/provider.js';

describe('Engine: Templates Lint Service y Endpoints (S6-05)', () => {
  let app: FastifyInstance;
  let mockStorage: StorageProvider;
  let mockSupabase: SupabaseClient;
  let userPermissions: string[];
  let isSuperuser: boolean;

  const validUserId = '11111111-1111-1111-1111-111111111111';
  const validTemplateId = '22222222-2222-2222-2222-222222222222';

  beforeAll(async () => {
    process.env.SUPABASE_URL = 'http://localhost:54321';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    userPermissions = ['documents.read'];
    isSuperuser = false;

    mockStorage = {
      code: 'supabase',
      put: vi.fn().mockResolvedValue(undefined),
      get: vi.fn(),
      delete: vi.fn().mockResolvedValue(undefined),
      exists: vi.fn().mockResolvedValue(false),
      signedUrl: vi
        .fn()
        .mockResolvedValue('https://signed.url/v1/download-template?token=signed60s'),
      healthCheck: vi.fn().mockResolvedValue(true),
    };
    setTemplatesStorageProvider(mockStorage);

    mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: validUserId, email: 'usuario@test.pe' } },
          error: null,
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { is_active: true },
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
                      is_superuser: isSuperuser,
                      is_active: true,
                      requires_mfa: false,
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
        if (table === 'document_fields') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ code: 'client.name' }, { code: 'causante.name' }, { code: 'case.number' }],
                error: null,
              }),
            }),
          };
        }
        if (table === 'templates') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockImplementation(() =>
                  Promise.resolve({
                    data: {
                      id: validTemplateId,
                      name: 'Plantilla Test',
                      storage_key: 'test/v1_plantilla.docx',
                    },
                    error: null,
                  }),
                ),
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      }),
    } as unknown as SupabaseClient;

    setSupabaseServiceClient(mockSupabase);
  });

  const validFields = ['client.name', 'causante.name', 'case.number'];

  function createTestDocxBuffer(xmlContent: string, includeVba = false): Buffer {
    const zip = new PizZip();
    zip.file('word/document.xml', xmlContent);
    if (includeVba) {
      zip.file('word/vbaProject.bin', 'dummy macro binary');
    }
    return zip.generate({ type: 'nodebuffer' }) as Buffer;
  }

  describe('lintDocxBuffer', () => {
    it('valida exitosamente un archivo DOCX con marcadores válidos y continuos', () => {
      const xml = `
        <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
          <w:body>
            <w:p>
              <w:r><w:t>Sucesión Intestada del causante </w:t></w:r>
              <w:r><w:t>{{causante.name}}</w:t></w:r>
            </w:p>
          </w:body>
        </w:document>
      `;

      const buffer = createTestDocxBuffer(xml);
      const result = lintDocxBuffer(buffer, validFields, 'solicitud.docx');

      expect(result.isValid).toBe(true);
      expect(result.placeholders).toEqual(['causante.name']);
      expect(result.errors).toHaveLength(0);
      expect(result.brokenMarkers).toHaveLength(0);
    });

    it('detecta y rechaza marcadores partidos por Word (<w:r>)', () => {
      const xml = `
        <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
          <w:body>
            <w:p>
              <w:r><w:t>Expediente N° </w:t></w:r>
              <w:r><w:t>{{case.</w:t></w:r>
              <w:r><w:t>number}}</w:t></w:r>
            </w:p>
          </w:body>
        </w:document>
      `;

      const buffer = createTestDocxBuffer(xml);
      const result = lintDocxBuffer(buffer, validFields, 'solicitud.docx');

      expect(result.isValid).toBe(false);
      expect(result.brokenMarkers.length).toBeGreaterThan(0);
      expect(result.brokenMarkers[0]).toContain('partido por Word');
      expect(result.errors).toContain(result.brokenMarkers[0]);
    });

    it('rechaza archivos con extensión .docm', () => {
      const xml = `<w:document><w:body><w:p><w:r><w:t>{{client.name}}</w:t></w:r></w:p></w:body></w:document>`;
      const buffer = createTestDocxBuffer(xml);
      const result = lintDocxBuffer(buffer, validFields, 'plantilla_con_macros.docm');

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('.docm'))).toBe(true);
    });

    it('rechaza archivos que contienen vbaProject.bin aunque se llamen .docx', () => {
      const xml = `<w:document><w:body><w:p><w:r><w:t>{{client.name}}</w:t></w:r></w:p></w:body></w:document>`;
      const buffer = createTestDocxBuffer(xml, true);
      const result = lintDocxBuffer(buffer, validFields, 'trampa_oculta.docx');

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('vbaProject.bin'))).toBe(true);
    });

    it('rechaza y marca inválido si contiene marcadores que no están en el catálogo', () => {
      const xml = `
        <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
          <w:body>
            <w:p>
              <w:r><w:t>{{client.name}}</w:t></w:r>
              <w:r><w:t>{{marcador_fantasma}}</w:t></w:r>
            </w:p>
          </w:body>
        </w:document>
      `;

      const buffer = createTestDocxBuffer(xml);
      const result = lintDocxBuffer(buffer, validFields, 'plantilla.docx');

      // Decisión de política: bloquea la subida
      expect(result.isValid).toBe(false);
      expect(result.unknownPlaceholders).toContain('marcador_fantasma');
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.includes('marcador_fantasma'))).toBe(true);
    });
  });

  describe('Endpoint POST /v1/templates/lint', () => {
    it('retorna error 401 si no se envía encabezado Authorization', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/templates/lint',
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('UNAUTHORIZED');
    });

    it('retorna error 400 si se envía JWT válido pero el contenido no es multipart', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/templates/lint',
        headers: {
          authorization: 'Bearer valid.mock.jwt',
          'content-type': 'application/json',
        },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('NO_FILE');
    });
  });

  describe('Endpoint GET /v1/templates/:id/download', () => {
    it('retorna 401 si no se envía encabezado Authorization', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/v1/templates/${validTemplateId}/download`,
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('UNAUTHORIZED');
    });

    it('retorna 403 si el usuario autenticado no posee permiso documents.read ni templates.manage', async () => {
      userPermissions = ['clients.read']; // Sin permisos de lectura documental ni gestión de plantillas

      const response = await app.inject({
        method: 'GET',
        url: `/v1/templates/${validTemplateId}/download`,
        headers: {
          authorization: 'Bearer valid.mock.jwt',
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('FORBIDDEN_INSUFFICIENT_PERMISSIONS');
    });

    it('retorna 200 con downloadUrl si el usuario posee permiso documents.read', async () => {
      userPermissions = ['documents.read'];

      const response = await app.inject({
        method: 'GET',
        url: `/v1/templates/${validTemplateId}/download`,
        headers: {
          authorization: 'Bearer valid.mock.jwt',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.downloadUrl).toBeDefined();
      expect(body.downloadUrl).toContain('https://signed.url');
      expect(body.expiresIn).toBe(60);
    });

    it('retorna 200 con downloadUrl si el usuario posee permiso templates.manage', async () => {
      userPermissions = ['templates.manage'];

      const response = await app.inject({
        method: 'GET',
        url: `/v1/templates/${validTemplateId}/download`,
        headers: {
          authorization: 'Bearer valid.mock.jwt',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.downloadUrl).toBeDefined();
      expect(body.expiresIn).toBe(60);
    });
  });
});
