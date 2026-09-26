import type { UploadVersionResponse } from '@workflow/shared';
import { getStorageProvider, getSupabaseServiceClient } from '../storage/index.js';
import { createDocumentError, type UploadFileOptions } from './documents-types.js';
import { validateUploadFile } from './documents-validation.js';
import { verifyUserUploadAccess } from './documents-access.js';

export async function uploadDocumentVersion(
  options: UploadFileOptions
): Promise<UploadVersionResponse> {
  const supabase = getSupabaseServiceClient();
  const storage = getStorageProvider();

  const { sha256 } = await validateUploadFile(supabase, options.fileBuffer, options.claimedMime);
  const { userId, caseId } = await verifyUserUploadAccess(supabase, options.userJwt, options.caseDocumentId);

  const { data: existingVersions } = await supabase
    .from('document_versions')
    .select('version')
    .eq('case_document_id', options.caseDocumentId)
    .order('version', { ascending: false })
    .limit(1);

  const nextVersionNumber = (existingVersions?.[0]?.version ?? 0) + 1;

  // Deduplicación por sha256 (01-anexo §B.5 #5)
  const { data: existingStorage } = await supabase
    .from('document_versions')
    .select('storage_key')
    .eq('sha256', sha256)
    .limit(1)
    .maybeSingle();

  let storageKey = existingStorage?.storage_key;
  if (!storageKey) {
    const cleanName = options.originalFilename.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
    storageKey = `${caseId}/${options.caseDocumentId}/v${nextVersionNumber}/${cleanName}`;
    await storage.put(storageKey, options.fileBuffer, {
      mime: options.claimedMime,
      sha256,
      size: options.fileBuffer.length,
    });
  }

  const { data: versionRecord, error: insertError } = await supabase
    .from('document_versions')
    .insert({
      case_document_id: options.caseDocumentId,
      version: nextVersionNumber,
      storage_backend: storage.code,
      storage_key: storageKey,
      file_name: options.originalFilename,
      size_bytes: options.fileBuffer.length,
      mime_type: options.claimedMime,
      sha256,
      change_summary: options.changeSummary ?? null,
      created_by: userId,
    })
    .select('id, version')
    .single();

  if (insertError || !versionRecord) {
    throw createDocumentError('Error al registrar versión de documento', 500, 'VERSION_INSERT_ERROR');
  }

  await supabase
    .from('case_documents')
    .update({ current_version_id: versionRecord.id, status: 'UPLOADED' })
    .eq('id', options.caseDocumentId);

  await supabase.from('audit_logs').insert({
    user_id: userId,
    module: 'documents',
    entity_type: 'document_version',
    entity_id: versionRecord.id,
    action: 'UPLOAD_DOCUMENT',
    new_data: {
      case_id: caseId,
      case_document_id: options.caseDocumentId,
      version: nextVersionNumber,
      file_name: options.originalFilename,
      size_bytes: options.fileBuffer.length,
      mime_type: options.claimedMime,
      sha256,
      is_deduplicated: Boolean(existingStorage),
    },
    ip_address: options.ipAddress ?? null,
    user_agent: options.userAgent ?? null,
  });

  return {
    version_id: versionRecord.id,
    version_number: versionRecord.version,
    case_document_id: options.caseDocumentId,
    case_id: caseId,
    file_name: options.originalFilename,
    size_bytes: options.fileBuffer.length,
    sha256,
    status: 'UPLOADED',
  };
}
