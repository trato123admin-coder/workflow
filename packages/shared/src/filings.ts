import { z } from 'zod';
import { getRemainingBusinessDays } from './business-days.js';

export const externalEntityContactSchema = z.object({
  name: z.string().min(1, 'El nombre del contacto es obligatorio'),
  role: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Correo de contacto inválido').optional().or(z.literal('')),
});

export type ExternalEntityContact = z.infer<typeof externalEntityContactSchema>;

export const externalEntitySchema = z.object({
  id: z.string().uuid().optional(),
  entity_type: z.string().min(1, 'El tipo de entidad es obligatorio'),
  name: z.string().min(1, 'El nombre de la entidad es obligatorio'),
  tax_id: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email('Correo electrónico inválido').nullable().optional().or(z.literal('')),
  contacts: z.array(externalEntityContactSchema).default([]),
  custom_data: z.record(z.unknown()).default({}),
  is_active: z.boolean().default(true),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type ExternalEntity = z.infer<typeof externalEntitySchema>;

export const caseFilingSchema = z.object({
  id: z.string().uuid().optional(),
  case_id: z.string().uuid('ID de caso inválido'),
  case_process_id: z.string().uuid().nullable().optional(),
  entity_id: z.string().uuid().nullable().optional(),
  filing_kind: z.string().min(1, 'El tipo de trámite es obligatorio'),
  reference_number: z.string().nullable().optional(),
  filed_at: z.string().nullable().optional(),
  status: z.string().default('PENDIENTE'),
  response_due_date: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
  responsible_user: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
  custom_data: z.record(z.unknown()).default({}),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type CaseFiling = z.infer<typeof caseFilingSchema>;

export type FilingUrgency = 'EXPIRED' | 'EXPIRING_SOON' | 'ON_TRACK' | 'DONE';

/**
 * Evalúa la urgencia de un trámite externo a partir de su categoría semántica
 * y los días hábiles restantes. NUNCA compara códigos de estado fijos.
 */
export function getFilingUrgency(
  filing: {
    statusCategory?: string;
    response_due_date?: string | null;
  },
  holidays: (string | Date)[] = [],
  warningThresholdDays = 3,
  currentDate?: Date | string,
): FilingUrgency {
  const cat = (filing.statusCategory || '').toUpperCase();
  if (cat === 'DONE' || cat === 'REJECTED') {
    return 'DONE';
  }

  if (!filing.response_due_date) {
    return 'ON_TRACK';
  }

  const remaining = getRemainingBusinessDays(filing.response_due_date, holidays, currentDate);
  if (remaining < 0) {
    return 'EXPIRED';
  }
  if (remaining <= warningThresholdDays) {
    return 'EXPIRING_SOON';
  }
  return 'ON_TRACK';
}
