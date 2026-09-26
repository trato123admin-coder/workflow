import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DEFAULT_ALLOWED_MIME_TYPES,
  DEFAULT_MAX_FILE_MB,
  validateMagicBytes,
} from '@workflow/shared';
import { createDocumentError } from './documents-types.js';
import { logger } from '../lib/logger.js';

function resolveMaxFileBytes(settingsMap: Map<string, unknown>): { maxBytes: number; maxMb: number } {
  let maxMb = DEFAULT_MAX_FILE_MB;
  const setting = settingsMap.get('storage.max_file_mb') ?? settingsMap.get('documents.max_file_mb');
  if (typeof setting === 'number' && setting > 0) {
    maxMb = setting;
  } else if (typeof setting === 'string' && !isNaN(Number(setting)) && Number(setting) > 0) {
    maxMb = Number(setting);
  }
  return { maxBytes: maxMb * 1024 * 1024, maxMb };
}

function resolveAllowedMimes(settingsMap: Map<string, unknown>): string[] {
  const setting = settingsMap.get('storage.allowed_mime') ?? settingsMap.get('documents.allowed_mime');
  if (Array.isArray(setting) && setting.length > 0) {
    return setting.map(String);
  }
  return [...DEFAULT_ALLOWED_MIME_TYPES];
}

/**
 * Valida los parámetros del archivo contra la configuración del sistema (system_settings):
 * límite de tamaño, lista de tipos MIME permitidos y Magic Bytes reales.
 */
export async function validateUploadFile(
  supabase: SupabaseClient,
  fileBuffer: Buffer,
  claimedMime: string
): Promise<{ sha256: string }> {
  const { data: settingsRows, error: settingsError } = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', [
      'storage.max_file_mb',
      'documents.max_file_mb',
      'storage.allowed_mime',
      'documents.allowed_mime',
    ]);

  if (settingsError) {
    logger.warn('Error al consultar system_settings para validación de archivo; aplicando valores predeterminados', {
      error: settingsError.message,
    });
  }

  const settingsMap = new Map<string, unknown>();
  for (const row of settingsRows ?? []) {
    settingsMap.set(row.key, row.value);
  }

  const { maxBytes, maxMb } = resolveMaxFileBytes(settingsMap);
  if (fileBuffer.length > maxBytes) {
    throw createDocumentError(
      `El archivo excede el tamaño máximo permitido (${maxMb} MB)`,
      413,
      'FILE_TOO_LARGE'
    );
  }

  const allowedMimes = resolveAllowedMimes(settingsMap);
  if (!allowedMimes.includes(claimedMime)) {
    throw createDocumentError(
      `El tipo MIME '${claimedMime}' no está permitido. Tipos admitidos: ${allowedMimes.join(', ')}`,
      415,
      'UNSUPPORTED_MEDIA_TYPE'
    );
  }

  const isValidSignature = validateMagicBytes(fileBuffer, claimedMime);
  if (!isValidSignature) {
    throw createDocumentError(
      `El contenido del archivo no coincide con su tipo declarado (${claimedMime}). Verificación de cabecera fallida`,
      400,
      'INVALID_FILE_SIGNATURE'
    );
  }

  const sha256 = createHash('sha256').update(fileBuffer).digest('hex');
  return { sha256 };
}
