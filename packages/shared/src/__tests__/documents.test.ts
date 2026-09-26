import { describe, it, expect } from 'vitest';
import {
  ALLOWED_MIME_TYPES,
  validateMagicBytes,
  checkM1ClosingGates,
  caseDocumentStatusSchema,
  documentVersionSchema,
} from '../documents.js';

describe('Shared Documents Module (S5-07)', () => {
  describe('ALLOWED_MIME_TYPES', () => {
    it('incluye exactamente PDF, DOCX, JPEG y PNG', () => {
      expect(ALLOWED_MIME_TYPES).toContain('application/pdf');
      expect(ALLOWED_MIME_TYPES).toContain(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );
      expect(ALLOWED_MIME_TYPES).toContain('image/jpeg');
      expect(ALLOWED_MIME_TYPES).toContain('image/png');
      expect(ALLOWED_MIME_TYPES.length).toBe(4);
    });
  });

  describe('validateMagicBytes', () => {
    it('valida cabecera válida de PDF (%PDF-)', () => {
      const pdfHeader = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
      expect(validateMagicBytes(pdfHeader, 'application/pdf')).toBe(true);
    });

    it('rechaza PDF con cabecera incorrecta', () => {
      const fakePdf = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
      expect(validateMagicBytes(fakePdf, 'application/pdf')).toBe(false);
    });

    it('valida cabecera válida de DOCX (ZIP PK\\x03\\x04)', () => {
      const docxHeader = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]);
      expect(
        validateMagicBytes(
          docxHeader,
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ),
      ).toBe(true);
    });

    it('valida cabecera válida de JPEG (0xFF 0xD8 0xFF)', () => {
      const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
      expect(validateMagicBytes(jpegHeader, 'image/jpeg')).toBe(true);
    });

    it('valida cabecera válida de PNG (0x89 PNG...)', () => {
      const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect(validateMagicBytes(pngHeader, 'image/png')).toBe(true);
    });

    it('rechaza buffers menores a 4 bytes o MIME no soportado', () => {
      expect(validateMagicBytes(new Uint8Array([0x25, 0x50]), 'application/pdf')).toBe(false);
      expect(validateMagicBytes(new Uint8Array([0x25, 0x50, 0x44, 0x46]), 'application/zip')).toBe(
        false,
      );
    });
  });

  describe('checkM1ClosingGates', () => {
    it('permite el cierre cuando todos los documentos obligatorios están validados', () => {
      const docs = [
        { is_required: true, status: 'VALIDATED' as const, is_active: true },
        { is_required: true, status: 'VALIDATED' as const, is_active: true },
        { is_required: false, status: 'PENDING' as const, is_active: true }, // Opcional pendiente no bloquea
        { is_required: true, status: 'PENDING' as const, is_active: false }, // Inactivo no bloquea
      ];

      const result = checkM1ClosingGates(docs);
      expect(result.canClose).toBe(true);
      expect(result.blockingReasons).toHaveLength(0);
    });

    it('bloquea el cierre si hay documentos obligatorios en PENDING', () => {
      const docs = [
        { is_required: true, status: 'VALIDATED' as const, is_active: true },
        { is_required: true, status: 'PENDING' as const, is_active: true },
      ];

      const result = checkM1ClosingGates(docs);
      expect(result.canClose).toBe(false);
      expect(result.blockingReasons).toContain(
        'Existen documentos obligatorios pendientes de carga',
      );
    });

    it('bloquea el cierre si hay documentos obligatorios en OBSERVED', () => {
      const docs = [
        { is_required: true, status: 'VALIDATED' as const, is_active: true },
        { is_required: true, status: 'OBSERVED' as const, is_active: true },
      ];

      const result = checkM1ClosingGates(docs);
      expect(result.canClose).toBe(false);
      expect(result.blockingReasons).toContain(
        'Existen documentos obligatorios con observaciones no subsanadas',
      );
    });
  });

  describe('Zod Schemas', () => {
    it('valida estados de documentos válidos', () => {
      expect(caseDocumentStatusSchema.parse('PENDING')).toBe('PENDING');
      expect(caseDocumentStatusSchema.parse('UPLOADED')).toBe('UPLOADED');
      expect(caseDocumentStatusSchema.parse('VALIDATED')).toBe('VALIDATED');
      expect(caseDocumentStatusSchema.parse('OBSERVED')).toBe('OBSERVED');
      expect(() => caseDocumentStatusSchema.parse('REJECTED')).toThrow();
    });

    it('valida versión de documento con sha256 válido', () => {
      const validVersion = {
        id: '11111111-1111-1111-1111-111111111111',
        case_document_id: '22222222-2222-2222-2222-222222222222',
        version: 1,
        storage_backend: 'supabase',
        storage_key: 'cases/123/doc/v1/file.pdf',
        file_name: 'partida.pdf',
        size_bytes: 1048576,
        mime_type: 'application/pdf',
        sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      };

      const parsed = documentVersionSchema.parse(validVersion);
      expect(parsed.version).toBe(1);
      expect(parsed.sha256).toHaveLength(64);
    });
  });
});
