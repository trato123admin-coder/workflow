import { z } from 'zod';
import type { PersonItem } from './persons.js';

export const PARTY_ROLES = ['CAUSANTE', 'HEREDERO', 'REPRESENTANTE', 'CURADOR', 'OTRO'] as const;
export type PartyRole = (typeof PARTY_ROLES)[number];

export const RELATIONSHIP_TYPES = [
  'CONYUGE',
  'CONVIVIENTE',
  'HIJO',
  'PADRE',
  'MADRE',
  'HERMANO',
  'NIETO',
  'OTRO',
] as const;
export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

export const HEIR_STATUSES = ['PRESUNTO', 'CONFIRMADO', 'EXCLUIDO', 'RENUNCIANTE'] as const;
export type HeirStatus = (typeof HEIR_STATUSES)[number];

export const CreateCasePartySchema = z
  .object({
    case_id: z.string().uuid('ID de caso inválido'),
    person_id: z.string().uuid('Debe seleccionar una persona válida'),
    party_role: z.enum(PARTY_ROLES, {
      errorMap: () => ({ message: 'Rol de interviniente inválido' }),
    }),
    relationship_to_deceased: z.enum(RELATIONSHIP_TYPES).nullish(),
    heir_status: z.enum(HEIR_STATUSES).nullish(),
    share_percent: z
      .number({ invalid_type_error: 'La cuota debe ser numérica' })
      .min(0, 'La cuota no puede ser menor a 0%')
      .max(100, 'La cuota no puede ser mayor a 100%')
      .nullish(),
    represented_by: z.string().uuid('Representante inválido').nullish().or(z.literal('')),
    notes: z.string().nullish(),
    custom_data: z.record(z.unknown()).default({}),
  })
  .refine(
    (data) => {
      if (data.party_role === 'HEREDERO' && data.heir_status === 'CONFIRMADO') {
        return data.share_percent !== undefined && data.share_percent !== null;
      }
      return true;
    },
    {
      message: 'Un heredero confirmado debe tener asignada una cuota porcentual',
      path: ['share_percent'],
    },
  );

export type CreateCasePartyInput = z.infer<typeof CreateCasePartySchema>;

export const UpdateCasePartySchema = z.object({
  party_role: z.enum(PARTY_ROLES).optional(),
  relationship_to_deceased: z.enum(RELATIONSHIP_TYPES).nullish(),
  heir_status: z.enum(HEIR_STATUSES).nullish(),
  share_percent: z
    .number()
    .min(0, 'La cuota no puede ser menor a 0%')
    .max(100, 'La cuota no puede ser mayor a 100%')
    .nullish(),
  represented_by: z.string().uuid().nullish().or(z.literal('')),
  notes: z.string().nullish(),
  is_active: z.boolean().optional(),
});

export type UpdateCasePartyInput = z.infer<typeof UpdateCasePartySchema>;

export const InitialPartyInputSchema = z.object({
  person_id: z.string().uuid('Persona requerida'),
  party_role: z.enum(PARTY_ROLES).default('HEREDERO'),
  relationship_to_deceased: z.enum(RELATIONSHIP_TYPES).nullish(),
  heir_status: z.enum(HEIR_STATUSES).default('PRESUNTO'),
  share_percent: z.number().min(0).max(100).nullish(),
  represented_by: z.string().uuid().nullish().or(z.literal('')),
});

export type InitialPartyInput = z.infer<typeof InitialPartyInputSchema>;

export interface CasePartyItem {
  id: string;
  case_id: string;
  person_id: string;
  party_role: PartyRole;
  relationship_to_deceased: RelationshipType | null;
  heir_status: HeirStatus | null;
  share_percent: number | null;
  represented_by: string | null;
  notes: string | null;
  custom_data: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  person?: PersonItem;
  representative?: PersonItem;
}
