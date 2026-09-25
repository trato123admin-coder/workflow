import { z } from 'zod';

export const CustomFieldEntitySchema = z.enum(['client', 'case', 'case_process']);
export type CustomFieldEntity = z.infer<typeof CustomFieldEntitySchema>;

export const CustomFieldDataTypeSchema = z.enum([
  'TEXT',
  'TEXTAREA',
  'NUMBER',
  'DATE',
  'BOOLEAN',
  'CURRENCY',
  'SELECT',
  'MULTISELECT',
]);
export type CustomFieldDataType = z.infer<typeof CustomFieldDataTypeSchema>;

export const CustomFieldDefinitionSchema = z.object({
  id: z.string().uuid().optional(),
  entity: CustomFieldEntitySchema,
  code: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9_]+$/, 'El código debe contener solo minúsculas, números y guiones bajos'),
  label: z.string().min(1).max(100),
  help_text: z.string().nullable().optional(),
  data_type: CustomFieldDataTypeSchema,
  catalog_code: z.string().nullable().optional(),
  options: z.array(z.string()).nullable().optional(),
  is_required: z.boolean().default(false),
  validation: z.record(z.unknown()).default({}),
  default_value: z.unknown().nullable().optional(),
  section: z.string().nullable().optional(),
  sort_order: z.number().int().default(0),
  applies_to: z.record(z.unknown()).default({}),
  read_permission: z.string().nullable().optional(),
  write_permission: z.string().nullable().optional(),
  is_active: z.boolean().default(true),
  is_system: z.boolean().default(false),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type CustomFieldDefinition = z.infer<typeof CustomFieldDefinitionSchema>;

export interface CustomDataValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

/**
 * Valida un diccionario de datos dinámicos contra las definiciones activas de la entidad
 */
export function validateCustomData(
  definitions: CustomFieldDefinition[],
  data: Record<string, unknown>
): CustomDataValidationResult {
  const errors: Record<string, string> = {};

  for (const def of definitions) {
    if (!def.is_active) continue;

    const val = data ? data[def.code] : undefined;

    // 1. Campo requerido
    if (def.is_required) {
      if (val === undefined || val === null || val === '') {
        errors[def.code] = `El campo ${def.label} es obligatorio`;
        continue;
      }
    }

    if (val === undefined || val === null || val === '') {
      continue;
    }

    // 2. Tipo de dato
    switch (def.data_type) {
      case 'NUMBER':
      case 'CURRENCY':
        if (typeof val !== 'number' || isNaN(val)) {
          errors[def.code] = `${def.label} debe ser un valor numérico`;
        }
        break;

      case 'BOOLEAN':
        if (typeof val !== 'boolean') {
          errors[def.code] = `${def.label} debe ser sí o no`;
        }
        break;

      case 'DATE':
        if (typeof val !== 'string' || isNaN(Date.parse(val))) {
          errors[def.code] = `${def.label} debe ser una fecha válida (YYYY-MM-DD)`;
        }
        break;

      case 'TEXT':
      case 'TEXTAREA':
      case 'SELECT':
        if (typeof val !== 'string') {
          errors[def.code] = `${def.label} debe ser texto`;
        }
        break;

      case 'MULTISELECT':
        if (!Array.isArray(val)) {
          errors[def.code] = `${def.label} debe ser una lista de opciones seleccionadas`;
        }
        break;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
