import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import PizZip from 'pizzip';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { lintDocxBuffer } from '../services/templates-service.js';

describe('Engine: Templates Lint Service y Endpoints (S6-05)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.SUPABASE_URL = 'http://localhost:54321';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
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
    it('retorna error 400 si no se envía ningún archivo', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/templates/lint',
        headers: {
          'content-type': 'application/json',
        },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('NO_FILE');
    });
  });
});
