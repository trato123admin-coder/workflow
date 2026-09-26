import { SIGNED_URL_TTL_SECONDS, type DownloadUrlResponse } from '@workflow/shared';
import { getStorageProvider, getSupabaseServiceClient } from '../storage/index.js';
import type { DownloadUrlOptions } from './documents-types.js';
import { verifyUserDownloadAccess } from './documents-access.js';

/**
 * Servicio de descarga auditada de versiones de documentos (Paso 4 / S5-05).
 * Valida can_access_case + documents.read, audita DOWNLOAD_DOCUMENT y genera URL firmada de 60s.
 */
export async function getAuditedDownloadUrl(
  options: DownloadUrlOptions
): Promise<DownloadUrlResponse> {
  const supabase = getSupabaseServiceClient();
  const storage = getStorageProvider();

  // 1. Validar autenticación, permisos y acceso al caso
  const { userId, versionRecord } = await verifyUserDownloadAccess(
    supabase,
    options.userJwt,
    options.versionId
  );

  // 2. Generar URL firmada con expiración estricta de 60 segundos
  const downloadUrl = await storage.signedUrl(
    versionRecord.storage_key,
    SIGNED_URL_TTL_SECONDS
  );

  // 3. Registrar auditoría append-only del evento DOWNLOAD_DOCUMENT
  await supabase.from('audit_logs').insert({
    user_id: userId,
    module: 'documents',
    entity_type: 'document_version',
    entity_id: versionRecord.id,
    action: 'DOWNLOAD_DOCUMENT',
    new_data: {
      case_id: versionRecord.case_documents.case_id,
      case_document_id: versionRecord.case_documents.id,
      version: versionRecord.version,
      file_name: versionRecord.file_name,
      size_bytes: versionRecord.size_bytes,
      mime_type: versionRecord.mime_type,
      sha256: versionRecord.sha256,
      ttl_seconds: SIGNED_URL_TTL_SECONDS,
    },
    ip_address: options.ipAddress ?? null,
    user_agent: options.userAgent ?? null,
  });

  return {
    download_url: downloadUrl,
    expires_in: SIGNED_URL_TTL_SECONDS,
    file_name: versionRecord.file_name,
    mime_type: versionRecord.mime_type,
    size_bytes: versionRecord.size_bytes,
  };
}
