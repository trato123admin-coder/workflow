import { z } from 'zod';
import type { PersonItem } from './persons.js';

export const ASSET_TYPES = [
  'INMUEBLE',
  'VEHICULO',
  'CUENTA_BANCARIA',
  'PARTICIPACION_EMPRESARIAL',
  'MUEBLE',
  'OTRO',
] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

export const ASSET_STATUSES = [
  'IDENTIFICADO',
  'VERIFICADO',
  'TRANSFERIDO',
  'EN_LITIGIO',
] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export const LIABILITY_TYPES = [
  'TRIBUTARIA',
  'BANCARIA',
  'PERSONAL',
  'OTRA',
] as const;
export type LiabilityType = (typeof LIABILITY_TYPES)[number];

export const LIABILITY_STATUSES = [
  'IDENTIFICADA',
  'VERIFICADA',
  'PAGADA',
  'DISPUTADA',
] as const;
export type LiabilityStatus = (typeof LIABILITY_STATUSES)[number];

export const ESTATE_CURRENCIES = ['PEN', 'USD'] as const;
export type EstateCurrency = (typeof ESTATE_CURRENCIES)[number];

export const CreateCaseAssetSchema = z
  .object({
    case_id: z.string().uuid('ID de caso inválido'),
    asset_type: z.enum(ASSET_TYPES, {
      errorMap: () => ({ message: 'Tipo de activo inválido' }),
    }),
    description: z.string().min(3, 'La descripción debe tener al menos 3 caracteres'),
    registry_office: z.string().nullish(),
    registry_ref: z.string().nullish(),
    ownership_percent: z
      .number({ invalid_type_error: 'El porcentaje debe ser numérico' })
      .min(0, 'El porcentaje mínimo es 0%')
      .max(100, 'El porcentaje máximo es 100%')
      .default(100),
    estimated_value: z.number().min(0, 'El valor estimado no puede ser negativo').nullish(),
    currency: z.enum(ESTATE_CURRENCIES).default('PEN'),
    status: z.enum(ASSET_STATUSES).default('IDENTIFICADO'),
    custom_data: z.record(z.unknown()).default({}),
  })
  .refine(
    (data) => {
      // REGLA NO NEGOCIABLE (00-maestro §3.2, §7): Cuentas bancarias SOLO últimos 4 dígitos.
      if (data.asset_type === 'CUENTA_BANCARIA' && data.registry_ref) {
        return /^\d{4}$/.test(data.registry_ref.trim());
      }
      return true;
    },
    {
      message: 'En cuentas bancarias solo debe ingresar los últimos 4 dígitos exactos.',
      path: ['registry_ref'],
    }
  );

export type CreateCaseAssetInput = z.infer<typeof CreateCaseAssetSchema>;

export const UpdateCaseAssetSchema = z
  .object({
    asset_type: z.enum(ASSET_TYPES).optional(),
    description: z.string().min(3).optional(),
    registry_office: z.string().nullish(),
    registry_ref: z.string().nullish(),
    ownership_percent: z.number().min(0).max(100).optional(),
    estimated_value: z.number().min(0).nullish(),
    currency: z.enum(ESTATE_CURRENCIES).optional(),
    status: z.enum(ASSET_STATUSES).optional(),
    is_active: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.asset_type === 'CUENTA_BANCARIA' && data.registry_ref) {
        return /^\d{4}$/.test(data.registry_ref.trim());
      }
      return true;
    },
    {
      message: 'En cuentas bancarias solo debe ingresar los últimos 4 dígitos exactos.',
      path: ['registry_ref'],
    }
  );

export type UpdateCaseAssetInput = z.infer<typeof UpdateCaseAssetSchema>;

export const CreateCaseLiabilitySchema = z.object({
  case_id: z.string().uuid('ID de caso inválido'),
  liability_type: z.enum(LIABILITY_TYPES, {
    errorMap: () => ({ message: 'Tipo de pasivo inválido' }),
  }),
  creditor_name: z.string().min(2, 'El nombre del acreedor es obligatorio'),
  creditor_person_id: z.string().uuid().nullish().or(z.literal('')),
  amount: z.number().min(0, 'El monto no puede ser negativo').nullish(),
  currency: z.enum(ESTATE_CURRENCIES).default('PEN'),
  status: z.enum(LIABILITY_STATUSES).default('IDENTIFICADA'),
  due_date: z.string().nullish(),
  notes: z.string().nullish(),
  custom_data: z.record(z.unknown()).default({}),
});

export type CreateCaseLiabilityInput = z.infer<typeof CreateCaseLiabilitySchema>;

export const UpdateCaseLiabilitySchema = z.object({
  liability_type: z.enum(LIABILITY_TYPES).optional(),
  creditor_name: z.string().min(2).optional(),
  creditor_person_id: z.string().uuid().nullish().or(z.literal('')),
  amount: z.number().min(0).nullish(),
  currency: z.enum(ESTATE_CURRENCIES).optional(),
  status: z.enum(LIABILITY_STATUSES).optional(),
  due_date: z.string().nullish(),
  notes: z.string().nullish(),
  is_active: z.boolean().optional(),
});

export type UpdateCaseLiabilityInput = z.infer<typeof UpdateCaseLiabilitySchema>;

export interface CaseAssetItem {
  id: string;
  case_id: string;
  asset_type: AssetType;
  description: string;
  registry_office: string | null;
  registry_ref: string | null;
  ownership_percent: number;
  estimated_value: number | null;
  currency: EstateCurrency;
  status: AssetStatus;
  custom_data: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CaseLiabilityItem {
  id: string;
  case_id: string;
  liability_type: LiabilityType;
  creditor_name: string;
  creditor_person_id: string | null;
  amount: number | null;
  currency: EstateCurrency;
  status: LiabilityStatus;
  due_date: string | null;
  notes: string | null;
  custom_data: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  creditor_person?: PersonItem;
}

export interface ConsolidatedEstateSummary {
  totalAssetsPen: number;
  totalAssetsUsd: number;
  totalLiabilitiesPen: number;
  totalLiabilitiesUsd: number;
  netEstatePen: number;
  netEstateUsd: number;
  assetsCount: number;
  liabilitiesCount: number;
}
