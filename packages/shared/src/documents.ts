import { z } from 'zod';

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];
export const DEFAULT_ALLOWED_MIME_TYPES = ALLOWED_MIME_TYPES;

export const DEFAULT_MAX_FILE_MB = 10;
export const DEFAULT_MAX_FILE_BYTES = DEFAULT_MAX_FILE_MB * 1024 * 1024;
export const DEFAULT_IMAGE_MAX_PX = 2000;
export const SIGNED_URL_TTL_SECONDS = 60;

/**
 * Validador de números mágicos (magic bytes / file signature).
 * Evita la suplantación de extensiones o MIME types falsificados.
 */
export function validateMagicBytes(buffer: Uint8Array | Buffer, expectedMime: string): boolean {
  if (!buffer || buffer.length < 4) {
    return false;
  }

  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  switch (expectedMime) {
    case 'application/pdf':
      // %PDF- (0x25, 0x50, 0x44, 0x46)
      return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;

    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      // DOCX es un archivo ZIP que inicia con PK (0x50, 0x4B, 0x03, 0x04)
      return bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;

    case 'image/jpeg':
      // JPEG inicia con 0xFF, 0xD8, 0xFF
      return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;

    case 'image/png':
      // PNG inicia con 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A
      return (
        bytes.length >= 8 &&
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47 &&
        bytes[4] === 0x0d &&
        bytes[5] === 0x0a &&
        bytes[6] === 0x1a &&
        bytes[7] === 0x0a
      );

    default:
      return false;
  }
}

/**
 * Esquemas Zod para entidades y operaciones documentarias
 */
export const caseDocumentStatusSchema = z.enum(['PENDING', 'UPLOADED', 'VALIDATED', 'OBSERVED']);
export type CaseDocumentStatus = z.infer<typeof caseDocumentStatusSchema>;

export const documentNatureSchema = z.enum(['GENERATED', 'UPLOADED', 'EXTERNAL']);
export type DocumentNature = z.infer<typeof documentNatureSchema>;

export const documentScopeSchema = z.enum(['CASO', 'PERSONA', 'BIEN']);
export type DocumentScope = z.infer<typeof documentScopeSchema>;

export const storageBackendKindSchema = z.enum(['supabase', 's3', 'gdrive']);
export type StorageBackendKind = z.infer<typeof storageBackendKindSchema>;

export const documentTypeSchema = z.object({
  id: z.string().uuid(),
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  nature: documentNatureSchema,
  scope: documentScopeSchema,
  party_role: z.string().nullable().optional(),
  asset_type: z.string().nullable().optional(),
  applies_to_person_types: z.array(z.string()).default(['NATURAL']),
  validity_days: z.number().int().positive().nullable().optional(),
  requires_template: z.boolean().default(false),
  is_active: z.boolean().default(true),
  metadata: z.record(z.unknown()).default({}),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});
export type DocumentType = z.infer<typeof documentTypeSchema>;

export const documentVersionSchema = z.object({
  id: z.string().uuid(),
  case_document_id: z.string().uuid(),
  version: z.number().int().positive(),
  storage_backend: z.string().min(1),
  storage_key: z.string().min(1),
  file_name: z.string().min(1),
  size_bytes: z.number().int().positive(),
  mime_type: z.string().min(1),
  sha256: z.string().length(64),
  change_summary: z.string().nullable().optional(),
  created_by: z.string().uuid().nullable().optional(),
  created_at: z.string().optional(),
  backed_up_at: z.string().nullable().optional(),
  backup_ref: z.string().nullable().optional(),
});
export type DocumentVersion = z.infer<typeof documentVersionSchema>;

export const caseDocumentSchema = z.object({
  id: z.string().uuid(),
  case_id: z.string().uuid(),
  case_process_id: z.string().uuid().nullable().optional(),
  document_type_id: z.string().uuid(),
  person_id: z.string().uuid().nullable().optional(),
  asset_id: z.string().uuid().nullable().optional(),
  party_id: z.string().uuid().nullable().optional(),
  status: caseDocumentStatusSchema.default('PENDING'),
  is_required: z.boolean().default(true),
  issue_date: z.string().nullable().optional(),
  valid_until: z.string().nullable().optional(),
  current_version_id: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
  is_active: z.boolean().default(true),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});
export type CaseDocument = z.infer<typeof caseDocumentSchema>;

export const uploadVersionResponseSchema = z.object({
  version_id: z.string().uuid(),
  version_number: z.number().int().positive(),
  case_document_id: z.string().uuid(),
  case_id: z.string().uuid(),
  file_name: z.string(),
  size_bytes: z.number().int().positive(),
  sha256: z.string().length(64),
  status: caseDocumentStatusSchema,
});
export type UploadVersionResponse = z.infer<typeof uploadVersionResponseSchema>;

export const downloadUrlResponseSchema = z.object({
  download_url: z.string().url(),
  expires_in: z.number().int().positive(),
  file_name: z.string(),
  mime_type: z.string(),
  size_bytes: z.number().int().positive(),
});
export type DownloadUrlResponse = z.infer<typeof downloadUrlResponseSchema>;

/**
 * Compuertas de Cierre M1 (00-maestro §3.2, 02-plan-sprints S5-07):
 * Un proceso o caso solo puede cerrarse si NO tiene documentos obligatorios en estado PENDING u OBSERVED.
 */
export function checkM1ClosingGates(
  documents: Array<{ is_required: boolean; status: CaseDocumentStatus; is_active: boolean }>,
): { canClose: boolean; blockingReasons: string[] } {
  const blockingReasons: string[] = [];

  for (const doc of documents) {
    if (!doc.is_active || !doc.is_required) {
      continue;
    }

    if (doc.status === 'PENDING') {
      blockingReasons.push('Existen documentos obligatorios pendientes de carga');
      break;
    }
  }

  for (const doc of documents) {
    if (!doc.is_active || !doc.is_required) {
      continue;
    }

    if (doc.status === 'OBSERVED') {
      blockingReasons.push('Existen documentos obligatorios con observaciones no subsanadas');
      break;
    }
  }

  return {
    canClose: blockingReasons.length === 0,
    blockingReasons,
  };
}
