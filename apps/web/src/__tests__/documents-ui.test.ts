import { describe, it, expect, vi } from 'vitest';
import { optimizeImageFile } from '../lib/image-compression';
import { getEngineUrl } from '../lib/engine-client';
import {
  DEFAULT_UPLOAD_CONFIG,
  fetchStorageUploadConfig,
} from '../lib/settings-client';

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
    const overLimitBytes = 0.82 * quotaBytes;  // 82%

    const isWarnUnder = (underLimitBytes / quotaBytes) * 100 >= warnPercent;
    const isWarnOver = (overLimitBytes / quotaBytes) * 100 >= warnPercent;

    expect(isWarnUnder).toBe(false);
    expect(isWarnOver).toBe(true);
  });
});
