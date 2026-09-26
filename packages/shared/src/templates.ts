import { z } from 'zod';

export const documentFieldDataTypeSchema = z.enum([
  'TEXT',
  'NUMBER',
  'DATE',
  'BOOLEAN',
  'CURRENCY',
  'SELECT',
  'MULTISELECT',
  'TEXTAREA',
]);

export type DocumentFieldDataType = z.infer<typeof documentFieldDataTypeSchema>;

export const documentFieldSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().min(1, 'El código de campo es obligatorio'),
  label: z.string().min(1, 'La etiqueta de campo es obligatoria'),
  data_type: documentFieldDataTypeSchema,
  source_type: z.string().min(1),
  source_path: z
    .string()
    .regex(
      /^(case|client|parties|estate|liabilities|system|custom)\.[a-zA-Z0-9_.]+$/,
      'Ruta de origen no válida o fuera del espacio de nombres permitido'
    ),
  is_required: z.boolean().default(false),
  default_value: z.string().nullable().optional(),
  validation: z.record(z.unknown()).default({}),
  description: z.string().nullable().optional(),
  is_active: z.boolean().default(true),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type DocumentField = z.infer<typeof documentFieldSchema>;

export const templateSchema = z.object({
  id: z.string().uuid().optional(),
  document_type_id: z.string().uuid('ID de tipo documental inválido'),
  name: z.string().min(1, 'El nombre de la plantilla es obligatorio'),
  version: z.number().int().min(1).default(1),
  storage_backend: z.string().default('SUPABASE'),
  storage_key: z.string().min(1, 'La clave de almacenamiento es obligatoria'),
  mime_type: z
    .string()
    .default('application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
  checksum: z.string().nullable().optional(),
  valid_from: z.string().min(1, 'La fecha de inicio de vigencia es obligatoria'),
  valid_until: z.string().nullable().optional(),
  estimated_manual_minutes: z.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
  metadata: z.record(z.unknown()).default({}),
  created_by: z.string().uuid().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type Template = z.infer<typeof templateSchema>;

export const templateFieldSchema = z.object({
  id: z.string().uuid().optional(),
  template_id: z.string().uuid('ID de plantilla inválido'),
  document_field_id: z.string().uuid('ID de campo inválido'),
  placeholder: z.string().min(1, 'El marcador es obligatorio'),
  position_data: z.record(z.unknown()).default({}),
  is_required: z.boolean().default(false),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type TemplateField = z.infer<typeof templateFieldSchema>;

export interface DocxLintResult {
  isValid: boolean;
  placeholders: string[];
  unknownPlaceholders: string[];
  brokenMarkers: string[];
  errors: string[];
  warnings: string[];
}

/**
 * Detecta si un archivo corresponde a una plantilla con macros (.docm o binario vbaProject).
 */
export function isMacroEnabledDocx(
  filename: string,
  mimeType?: string,
  entryNames: string[] = []
): boolean {
  if (filename.toLowerCase().endsWith('.docm')) {
    return true;
  }
  if (mimeType?.includes('macroEnabled') || mimeType?.includes('wordprocessingml.template.macroEnabled')) {
    return true;
  }
  for (const name of entryNames) {
    if (name.toLowerCase().includes('vbaproject.bin')) {
      return true;
    }
  }
  return false;
}

/**
 * Analiza el contenido XML de un documento DOCX (word/document.xml y similares)
 * para extraer marcadores {{...}}, detectar marcadores partidos por Word en múltiples <w:r>
 * y contrastar contra la lista blanca de campos autorizados.
 */
export function lintDocxXml(documentXml: string, validPlaceholders: string[] = []): DocxLintResult {
  const result: DocxLintResult = {
    isValid: true,
    placeholders: [],
    unknownPlaceholders: [],
    brokenMarkers: [],
    errors: [],
    warnings: [],
  };

  if (!documentXml) {
    result.isValid = false;
    result.errors.push('El contenido XML del documento está vacío');
    return result;
  }

  // Conjunto de lista blanca normalizado a minúsculas
  const validSet = new Set(validPlaceholders.map((p) => p.trim().toLowerCase()));

  // 1. Extraer párrafos (<w:p>...</w:p>)
  const paragraphRegex = /<w:p(?:\s+[^>]*)?>([\s\S]*?)<\/w:p>/g;
  let pMatch: RegExpExecArray | null;

  const foundPlaceholdersSet = new Set<string>();

  while ((pMatch = paragraphRegex.exec(documentXml)) !== null) {
    const pContent = pMatch[1] ?? '';

    // Extraer los nodos de texto individuales <w:t> en el párrafo
    const textNodeRegex = /<w:t(?:\s+[^>]*)?>([\s\S]*?)<\/w:t>/g;
    const textNodes: string[] = [];
    let tMatch: RegExpExecArray | null;
    while ((tMatch = textNodeRegex.exec(pContent)) !== null) {
      if (tMatch[1] !== undefined) {
        textNodes.push(tMatch[1]);
      }
    }

    const paragraphText = textNodes.join('');

    // Detección de marcadores desbalanceados dentro del párrafo
    const openCount = (paragraphText.match(/\{\{/g) || []).length;
    const closeCount = (paragraphText.match(/\}\}/g) || []).length;
    if (openCount !== closeCount) {
      result.brokenMarkers.push(
        `Marcador desbalanceado en párrafo: ${openCount} apertura(s) '{{' y ${closeCount} cierre(s) '}}'`
      );
    }

    // Buscar marcadores completos {{placeholder}} en el texto del párrafo
    const placeholderRegex = /\{\{([^{}]+)\}\}/g;
    let phMatch: RegExpExecArray | null;

    while ((phMatch = placeholderRegex.exec(paragraphText)) !== null) {
      const fullMarker = phMatch[0] ?? ''; // {{campo}}
      const phName = (phMatch[1] ?? '').trim();

      if (!phName) continue;

      if (!foundPlaceholdersSet.has(phName)) {
        foundPlaceholdersSet.add(phName);
        result.placeholders.push(phName);
      }

      // Comprobar si el marcador {{campo}} está contenido íntegramente en algún <w:t>
      // Si existe en el párrafo concatenado pero NO en ningún <w:t> individual, Word lo fragmentó en varios <w:r>
      const isContainedInSingleNode = textNodes.some((node) => node.includes(fullMarker));
      if (!isContainedInSingleNode) {
        result.brokenMarkers.push(
          `Marcador '${fullMarker}' partido por Word en múltiples fragmentos XML (<w:r>). Debe reescribirse de corrido.`
        );
      }
    }
  }

  // 2. Verificar marcadores desconocidos contra la lista blanca (Decisión de Política: BLOQUEANTE)
  if (validSet.size > 0) {
    for (const ph of result.placeholders) {
      if (!validSet.has(ph.toLowerCase())) {
        result.unknownPlaceholders.push(ph);
        result.errors.push(
          `El marcador '{{${ph}}}' no coincide con ningún campo autorizado en el catálogo blanco de document_fields.`
        );
      }
    }
  }

  // 3. Evaluar validez: tanto marcadores rotos como campos desconocidos invalidan la plantilla
  if (result.brokenMarkers.length > 0) {
    for (const bm of result.brokenMarkers) {
      result.errors.push(bm);
    }
  }

  if (result.errors.length > 0) {
    result.isValid = false;
  }

  return result;
}
