import { describe, it, expect } from 'vitest';
import { optimizeImageFile } from '../lib/image-compression';
import { getEngineUrl } from '../lib/engine-client';
import { DEFAULT_UPLOAD_CONFIG, fetchStorageUploadConfig } from '../lib/settings-client';
import { DocumentTypeFormSchema } from '../components/documents/CreateDocumentTypeModal';

describe('Document UI & Client Utilities (S5-04, S5-08, S5-09, S5-10)', () => {
  it('retorna URL base del Engine por defecto o desde variable', () => {
    const url = getEngineUrl();
    expect(url).toBeDefined();
    expect(typeof url).toBe('string');
    expect(url).toMatch(/http/);
  });

  it('no modifica archivos que no son imágenes (ej. PDF)', async () => {
    const mockPdf = new File(['%PDF-1.4 test content'], 'contrato.pdf', {
      type: 'application/pdf',
    });

    const result = await optimizeImageFile(mockPdf);
    expect(result.name).toBe('contrato.pdf');
    expect(result.type).toBe('application/pdf');
    expect(result.size).toBe(mockPdf.size);
  });

  it('proporciona configuración de subida por defecto cuando la base de datos no está disponible', async () => {
    const config = await fetchStorageUploadConfig();
    expect(config.maxFileMb).toBe(DEFAULT_UPLOAD_CONFIG.maxFileMb);
    expect(config.allowedMimes).toEqual(DEFAULT_UPLOAD_CONFIG.allowedMimes);
    expect(config.acceptAttribute).toContain('.pdf');
    expect(config.displayHelpText).toContain('Máx.');
  });

  it('calcula correctamente la advertencia de espacio de almacenamiento al superar el 80%', () => {
    const quotaBytes = 1024 * 1024 * 1024; // 1 GB
    const warnPercent = 80;

    const underLimitBytes = 0.75 * quotaBytes; // 75%
    const overLimitBytes = 0.82 * quotaBytes; // 82%

    const isWarnUnder = (underLimitBytes / quotaBytes) * 100 >= warnPercent;
    const isWarnOver = (overLimitBytes / quotaBytes) * 100 >= warnPercent;

    expect(isWarnUnder).toBe(false);
    expect(isWarnOver).toBe(true);
  });

  describe('DocumentTypeFormSchema - Validación Zod del Catálogo Maestro (S5-08)', () => {
    it('valida exitosamente un tipo documental de ámbito CASO', () => {
      const validCase = {
        code: 'ACTA_CONCILIACION',
        name: 'Acta de Conciliación Extrajudicial',
        category: 'LEGAL',
        nature: 'UPLOADED',
        scope: 'CASO',
        requires_template: false,
      };

      const result = DocumentTypeFormSchema.safeParse(validCase);
      expect(result.success).toBe(true);
    });

    it('rechaza código con minúsculas o caracteres inválidos', () => {
      const invalidCode = {
        code: 'acta-invalida!',
        name: 'Acta Inválida',
        category: 'LEGAL',
        nature: 'UPLOADED',
        scope: 'CASO',
        requires_template: false,
      };

      const result = DocumentTypeFormSchema.safeParse(invalidCode);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('code');
      }
    });

    it('exige party_role cuando el ámbito es PERSONA', () => {
      const missingRole = {
        code: 'CERT_DOMICILIARIO',
        name: 'Certificado Domiciliario',
        category: 'IDENTIDAD',
        nature: 'UPLOADED',
        scope: 'PERSONA',
        party_role: null,
        requires_template: false,
      };

      const result = DocumentTypeFormSchema.safeParse(missingRole);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('rol del interviniente');
      }

      const withRole = { ...missingRole, party_role: 'HEREDERO' };
      expect(DocumentTypeFormSchema.safeParse(withRole).success).toBe(true);
    });

    it('exige asset_type cuando el ámbito es BIEN', () => {
      const missingAsset = {
        code: 'GRAVAMEN_VEHICULAR',
        name: 'Certificado de Gravamen Vehicular',
        category: 'PATRIMONIO',
        nature: 'EXTERNAL',
        scope: 'BIEN',
        asset_type: null,
        requires_template: false,
      };

      const result = DocumentTypeFormSchema.safeParse(missingAsset);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('tipo de bien');
      }

      const withAsset = { ...missingAsset, asset_type: 'VEHICULO' };
      expect(DocumentTypeFormSchema.safeParse(withAsset).success).toBe(true);
    });
  });
});
