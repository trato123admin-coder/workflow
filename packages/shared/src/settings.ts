import { z } from 'zod';

export const SettingValueTypeSchema = z.enum([
  'string',
  'number',
  'boolean',
  'enum',
  'json',
  'color',
  'time',
  'duration',
  'list',
]);

export type SettingValueType = z.infer<typeof SettingValueTypeSchema>;

export const SettingDefinitionSchema = z.object({
  key: z.string().min(2),
  category: z.string().min(2),
  label: z.string().min(2),
  description: z.string().nullable().optional(),
  value_type: SettingValueTypeSchema,
  default_value: z.unknown(),
  constraints: z.record(z.unknown()).default({}),
  edit_permission: z.string().default('settings.manage'),
  requires_flag: z.string().nullable().optional(),
  sort_order: z.number().int().default(0),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type SettingDefinition = z.infer<typeof SettingDefinitionSchema>;

export const SystemSettingSchema = z.object({
  key: z.string().min(2),
  value: z.unknown(),
  updated_by: z.string().uuid().nullable().optional(),
  updated_at: z.string().optional(),
});

export type SystemSetting = z.infer<typeof SystemSettingSchema>;

export const SettingsHistoryItemSchema = z.object({
  id: z.string().uuid(),
  key: z.string(),
  old_value: z.unknown().nullable().optional(),
  new_value: z.unknown().nullable().optional(),
  reason: z.string().nullable().optional(),
  changed_by: z.string().uuid().nullable().optional(),
  changed_at: z.string(),
});

export type SettingsHistoryItem = z.infer<typeof SettingsHistoryItemSchema>;

/**
 * Valida un valor frente a su definición de tipo y restricciones
 */
export function validateSettingValue(
  definition: SettingDefinition,
  value: unknown,
): { valid: boolean; error?: string } {
  if (value === undefined || value === null) {
    return { valid: false, error: 'El valor no puede ser nulo' };
  }

  const { value_type, constraints } = definition;

  switch (value_type) {
    case 'string':
    case 'color':
    case 'time':
    case 'duration':
      if (typeof value !== 'string') {
        return { valid: false, error: 'Debe ser una cadena de texto' };
      }
      if (typeof constraints.min_length === 'number' && value.length < constraints.min_length) {
        return { valid: false, error: `Longitud mínima de ${constraints.min_length} caracteres` };
      }
      if (typeof constraints.max_length === 'number' && value.length > constraints.max_length) {
        return { valid: false, error: `Longitud máxima de ${constraints.max_length} caracteres` };
      }
      break;

    case 'number':
      if (typeof value !== 'number' || isNaN(value)) {
        return { valid: false, error: 'Debe ser un número válido' };
      }
      if (typeof constraints.min === 'number' && value < constraints.min) {
        return { valid: false, error: `El valor no puede ser menor a ${constraints.min}` };
      }
      if (typeof constraints.max === 'number' && value > constraints.max) {
        return { valid: false, error: `El valor no puede ser mayor a ${constraints.max}` };
      }
      break;

    case 'boolean':
      if (typeof value !== 'boolean') {
        return { valid: false, error: 'Debe ser verdadero o falso' };
      }
      break;

    case 'enum':
      if (Array.isArray(constraints.options) && !constraints.options.includes(value)) {
        return {
          valid: false,
          error: `Debe ser una de las opciones permitidas: ${constraints.options.join(', ')}`,
        };
      }
      break;

    case 'list':
      if (!Array.isArray(value)) {
        return { valid: false, error: 'Debe ser una lista' };
      }
      break;

    case 'json':
      if (typeof value !== 'object') {
        return { valid: false, error: 'Debe ser un objeto JSON válido' };
      }
      break;
  }

  return { valid: true };
}
