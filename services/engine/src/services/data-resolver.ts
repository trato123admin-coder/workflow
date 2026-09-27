/**
 * data-resolver.ts — Resolves template field values from a data snapshot.
 *
 * Pure function: no I/O, no side effects.
 * Used by the generation worker and preview endpoint.
 */

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface TemplateFieldInput {
  placeholder: string;
  document_field: {
    code: string;
    source_path: string;
    is_required: boolean;
    default_value: string | null;
  };
  is_required: boolean;
}

export interface ResolvedField {
  placeholder: string;
  value: unknown;
  source: string;
  isRequired: boolean;
}

export interface DataResolutionResult {
  /** Flat map placeholder → value, ready for docx-templates */
  data: Record<string, unknown>;
  /** Details of every resolved field */
  resolved: ResolvedField[];
  /** Placeholders of required fields that are missing */
  missing: string[];
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/**
 * Traverse an object using a dot-separated path.
 * Example: getByPath({ case: { number: '2026-001' } }, 'case.number') → '2026-001'
 */
function getByPath(obj: Record<string, unknown>, path: string): unknown {
  const segments = path.split('.');
  let current: unknown = obj;

  for (const segment of segments) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  return false;
}

/* ------------------------------------------------------------------ */
/* Main function                                                       */
/* ------------------------------------------------------------------ */

/**
 * Resolves template fields from the input data snapshot.
 *
 * For each template field:
 * 1. Extract value using `source_path` (dot-notation).
 * 2. If missing, use `default_value` when available.
 * 3. Track missing required fields.
 *
 * @returns Flat data map and metadata about resolution.
 */
export function resolveTemplateData(params: {
  templateFields: TemplateFieldInput[];
  inputData: Record<string, unknown>;
}): DataResolutionResult {
  const { templateFields, inputData } = params;

  const data: Record<string, unknown> = {};
  const resolved: ResolvedField[] = [];
  const missing: string[] = [];

  for (const field of templateFields) {
    const { placeholder, document_field, is_required } = field;
    const sourcePath = document_field.source_path;
    const fieldRequired = is_required || document_field.is_required;

    let value = getByPath(inputData, sourcePath);

    if (isEmptyValue(value) && document_field.default_value !== null) {
      value = document_field.default_value;
    }

    if (isEmptyValue(value) && fieldRequired) {
      missing.push(placeholder);
    }

    data[placeholder] = isEmptyValue(value) ? '' : value;
    resolved.push({
      placeholder,
      value: data[placeholder],
      source: sourcePath,
      isRequired: fieldRequired,
    });
  }

  return { data, resolved, missing };
}
