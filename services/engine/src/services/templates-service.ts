import { createHash } from 'node:crypto';
import PizZip from 'pizzip';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  lintDocxXml,
  isMacroEnabledDocx,
  type DocxLintResult,
  type Template,
} from '@workflow/shared';
import { authenticateUser, type UserContext } from './documents-access.js';
import { createDocumentError } from './documents-types.js';
import { getTemplatesStorageProvider } from '../storage/index.js';

export interface UploadTemplateOptions {
  userJwt: string;
  documentTypeId: string;
  name: string;
  fileBuffer: Buffer;
  filename: string;
  validFrom: string;
  validUntil?: string | null;
  estimatedManualMinutes?: number;
}

export async function verifyTemplateManageAccess(
  supabase: SupabaseClient,
  userJwt: string
): Promise<UserContext> {
  const userContext = await authenticateUser(supabase, userJwt);
  if (!userContext.isSuperuser && !userContext.permissionCodes.has('templates.manage')) {
    throw createDocumentError(
      'Se requiere permiso templates.manage para gestionar plantillas',
      403,
      'FORBIDDEN'
    );
  }
  return userContext;
}

/**
 * Extrae y valida la estructura de un archivo DOCX en memoria.
 */
export function lintDocxBuffer(
  buffer: Buffer,
  validPlaceholders: string[],
  filename: string
): DocxLintResult {
  // 1. Detección temprana de macros por nombre o extensión
  if (isMacroEnabledDocx(filename)) {
    return {
      isValid: false,
      placeholders: [],
      unknownPlaceholders: [],
      brokenMarkers: [],
      errors: ['Los archivos con extensión .docm o macros no están permitidos'],
      warnings: [],
    };
  }

  // 2. Descomprimir con PizZip
  let zip: PizZip;
  try {
    zip = new PizZip(buffer);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      isValid: false,
      placeholders: [],
      unknownPlaceholders: [],
      brokenMarkers: [],
      errors: [`El archivo no es un archivo ZIP / DOCX válido: ${msg}`],
      warnings: [],
    };
  }

  // 3. Inspeccionar si contiene vbaProject.bin o macros internas
  const fileEntries = Object.keys(zip.files);
  if (isMacroEnabledDocx(filename, undefined, fileEntries)) {
    return {
      isValid: false,
      placeholders: [],
      unknownPlaceholders: [],
      brokenMarkers: [],
      errors: ['El archivo DOCX contiene macros o binarios VBA (vbaProject.bin)'],
      warnings: [],
    };
  }

  // 4. Extraer word/document.xml
  const documentFile = zip.file('word/document.xml');
  if (!documentFile) {
    return {
      isValid: false,
      placeholders: [],
      unknownPlaceholders: [],
      brokenMarkers: [],
      errors: ['El archivo DOCX no contiene el cuerpo principal word/document.xml'],
      warnings: [],
    };
  }

  const xmlContent = documentFile.asText();

  // También podemos concatenar encabezados y pies si existen
  let fullXml = xmlContent;
  for (const entry of fileEntries) {
    if (
      (entry.startsWith('word/header') || entry.startsWith('word/footer')) &&
      entry.endsWith('.xml')
    ) {
      const extraFile = zip.file(entry);
      if (extraFile) {
        fullXml += extraFile.asText();
      }
    }
  }

  // 5. Ejecutar motor de lint
  return lintDocxXml(fullXml, validPlaceholders);
}

/**
 * Sube y registra una plantilla DOCX con service_role tras validar lint y tamaño.
 */
export async function uploadTemplate(
  supabase: SupabaseClient,
  options: UploadTemplateOptions
): Promise<{ template: Template; lintResult: DocxLintResult }> {
  // 1. Validar autenticación y permisos del usuario
  const user = await verifyTemplateManageAccess(supabase, options.userJwt);

  // 2. Validar tamaño contra system_settings y límite físico de 10 MB
  const { data: settingData } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'storage.max_file_size_mb')
    .maybeSingle();

  const maxMb = typeof settingData?.value === 'number' ? settingData.value : 10;
  const maxBytes = Math.min(maxMb * 1024 * 1024, 10485760); // 10 MB techo físico

  if (options.fileBuffer.length > maxBytes) {
    throw createDocumentError(
      `El archivo excede el tamaño máximo permitido de ${(maxBytes / (1024 * 1024)).toFixed(0)} MB`,
      400,
      'FILE_TOO_LARGE'
    );
  }

  // 3. Obtener catálogo de campos registrados para contrastar lista blanca
  const { data: fieldsData } = await supabase
    .from('document_fields')
    .select('id, code, label')
    .eq('is_active', true);

  const activeFields = fieldsData ?? [];
  const validPlaceholders = activeFields.map((f) => f.code);

  // 4. Ejecutar el linting
  const lintResult = lintDocxBuffer(
    options.fileBuffer,
    validPlaceholders,
    options.filename
  );

  if (!lintResult.isValid) {
    throw createDocumentError(
      `Plantilla rechazada por errores de formato: ${lintResult.errors.join('; ')}`,
      400,
      'TEMPLATE_LINT_FAILED'
    );
  }

  // 5. Calcular SHA-256
  const sha256 = createHash('sha256').update(options.fileBuffer).digest('hex');

  // 6. Determinar correlativo de versión
  const { data: existingVersions } = await supabase
    .from('templates')
    .select('version')
    .eq('document_type_id', options.documentTypeId)
    .order('version', { ascending: false })
    .limit(1);

  const nextVersion = (existingVersions?.[0]?.version ?? 0) + 1;

  // 7. Subir a Storage privado (bucket 'templates')
  const storage = getTemplatesStorageProvider();
  const cleanName = options.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storageKey = `${options.documentTypeId}/v${nextVersion}_${cleanName}`;

  await storage.put(storageKey, options.fileBuffer, {
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    sha256,
    size: options.fileBuffer.length,
  });

  // 8. Insertar registro en public.templates usando service_role
  const { data: templateRow, error: templateError } = await supabase
    .from('templates')
    .insert({
      document_type_id: options.documentTypeId,
      name: options.name,
      version: nextVersion,
      storage_backend: 'SUPABASE',
      storage_key: storageKey,
      mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      checksum: sha256,
      valid_from: options.validFrom,
      valid_until: options.validUntil || null,
      estimated_manual_minutes: options.estimatedManualMinutes ?? 0,
      is_active: true,
      created_by: user.userId,
    })
    .select('*')
    .single();

  if (templateError || !templateRow) {
    throw createDocumentError(
      `Error al registrar plantilla en la base de datos: ${templateError?.message}`,
      500,
      'DB_INSERT_ERROR'
    );
  }

  // 9. Registrar marcadores reconocidos en public.template_fields
  const fieldMap = new Map(activeFields.map((f) => [f.code.toLowerCase(), f.id]));
  for (const placeholder of lintResult.placeholders) {
    const fieldId = fieldMap.get(placeholder.toLowerCase());
    if (fieldId) {
      await supabase
        .from('template_fields')
        .insert({
          template_id: templateRow.id,
          document_field_id: fieldId,
          placeholder,
          is_required: false,
        });
    }
  }

  return {
    template: templateRow as Template,
    lintResult,
  };
}
