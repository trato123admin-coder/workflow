import { z } from 'zod';

export const CatalogItemMetadataSchema = z.record(z.unknown()).default({});

export const CatalogSchema = z.object({
  code: z.string().min(2).max(50),
  name: z.string().min(2).max(100),
  description: z.string().nullable().optional(),
  module: z.string().min(2).max(50),
  allow_new_items: z.boolean().default(true),
  item_schema: z.record(z.unknown()).default({}),
  is_system: z.boolean().default(false),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type Catalog = z.infer<typeof CatalogSchema>;

export const CatalogItemSchema = z.object({
  catalog_code: z.string().min(2).max(50),
  code: z.string().min(1).max(50),
  label: z.string().min(1).max(100),
  description: z.string().nullable().optional(),
  sort_order: z.number().int().default(0),
  color: z.string().nullable().optional(),
  metadata: CatalogItemMetadataSchema,
  is_system: z.boolean().default(false),
  is_active: z.boolean().default(true),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type CatalogItem = z.infer<typeof CatalogItemSchema>;

export const CreateCatalogItemSchema = z.object({
  catalog_code: z.string().min(2).max(50),
  code: z
    .string()
    .min(1)
    .max(50)
    .regex(
      /^[A-Z0-9_-]+$/,
      'El código debe contener solo mayúsculas, números, guiones y guiones bajos',
    ),
  label: z.string().min(1, 'La etiqueta es requerida').max(100),
  description: z.string().optional(),
  sort_order: z.number().int().default(0),
  color: z.string().optional(),
  metadata: CatalogItemMetadataSchema.optional(),
  is_active: z.boolean().default(true),
});

export type CreateCatalogItemInput = z.infer<typeof CreateCatalogItemSchema>;

export const UpdateCatalogItemSchema = z.object({
  label: z.string().min(1, 'La etiqueta es requerida').max(100).optional(),
  description: z.string().nullable().optional(),
  sort_order: z.number().int().optional(),
  color: z.string().nullable().optional(),
  metadata: CatalogItemMetadataSchema.optional(),
  is_active: z.boolean().optional(),
});

export type UpdateCatalogItemInput = z.infer<typeof UpdateCatalogItemSchema>;

/**
 * Valida los metadatos de un elemento según los requisitos de identity_document_types si corresponde.
 */
export function validateDocumentTypeMetadata(metadata: Record<string, unknown>): {
  valid: boolean;
  error?: string;
} {
  if (typeof metadata !== 'object' || metadata === null) {
    return { valid: false, error: 'Metadata debe ser un objeto' };
  }
  if ('pattern' in metadata && typeof metadata.pattern !== 'string') {
    return { valid: false, error: 'El patrón debe ser una cadena regex' };
  }
  if ('min_length' in metadata && typeof metadata.min_length !== 'number') {
    return { valid: false, error: 'min_length debe ser un número entero' };
  }
  if ('max_length' in metadata && typeof metadata.max_length !== 'number') {
    return { valid: false, error: 'max_length debe ser un número entero' };
  }
  return { valid: true };
}
