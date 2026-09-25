import { z } from 'zod';

/**
 * Validador de RUC peruano usando algoritmo Módulo 11 oficial (SUNAT).
 * Los pesos son [5, 4, 3, 2, 7, 6, 5, 4, 3, 2].
 */
export function validatePeruvianRuc(ruc: string): boolean {
  if (!/^\d{11}$/.test(ruc)) {
    return false;
  }

  const prefix = ruc.substring(0, 2);
  if (!['10', '15', '17', '20'].includes(prefix)) {
    return false;
  }

  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(ruc.charAt(i), 10) * (weights[i] ?? 0);
  }

  const remainder = sum % 11;
  let checkDigit = 11 - remainder;
  if (checkDigit === 10) checkDigit = 0;
  else if (checkDigit === 11) checkDigit = 1;

  return checkDigit === parseInt(ruc.charAt(10), 10);
}

/**
 * Validador de DNI peruano (exactamente 8 dígitos numéricos).
 */
export function validatePeruvianDni(dni: string): boolean {
  return /^\d{8}$/.test(dni);
}

export const PERSON_TYPE_CODES = ['NATURAL', 'JURIDICA'] as const;
export type PersonTypeCode = (typeof PERSON_TYPE_CODES)[number];

export const ID_DOCUMENT_TYPES = ['DNI', 'RUC', 'CE', 'PASAPORTE'] as const;
export type IdDocumentType = (typeof ID_DOCUMENT_TYPES)[number];

export const MARITAL_STATUS_CODES = [
  'SOLTERO',
  'CASADO',
  'VIUDO',
  'DIVORCIADO',
  'CONVIVIENTE',
] as const;
export type MaritalStatusCode = (typeof MARITAL_STATUS_CODES)[number];

export const PersonBaseSchema = z.object({
  person_type: z.enum(PERSON_TYPE_CODES),
  identity_document_type: z.string().min(1, 'El tipo de documento es obligatorio'),
  identity_document_number: z.string().min(1, 'El número de documento es obligatorio'),
  first_name: z.string().nullish(),
  last_name: z.string().nullish(), // Apellido paterno
  second_last_name: z.string().nullish(), // Apellido materno
  legal_name: z.string().nullish(),
  trade_name: z.string().nullish(),
  email: z.string().email('Correo electrónico inválido').nullish().or(z.literal('')),
  phone: z.string().nullish(),
  address: z.string().nullish(),
  birth_date: z.string().nullish(),
  marital_status: z.string().nullish(),
  custom_data: z.record(z.unknown()).default({}),
});

export const CreatePersonSchema = PersonBaseSchema.superRefine((data, ctx) => {
  // Validación según tipo de documento
  if (data.identity_document_type === 'DNI') {
    if (!validatePeruvianDni(data.identity_document_number)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'El DNI debe tener exactamente 8 dígitos numéricos',
        path: ['identity_document_number'],
      });
    }
  } else if (data.identity_document_type === 'RUC') {
    if (!validatePeruvianRuc(data.identity_document_number)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'El RUC debe tener 11 dígitos y cumplir el dígito verificador SUNAT',
        path: ['identity_document_number'],
      });
    }
  }

  // Validación según tipo de persona
  if (data.person_type === 'NATURAL') {
    if (!data.first_name || data.first_name.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'El primer nombre es obligatorio para personas naturales',
        path: ['first_name'],
      });
    }
    if (!data.last_name || data.last_name.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'El apellido paterno es obligatorio para personas naturales',
        path: ['last_name'],
      });
    }
  } else if (data.person_type === 'JURIDICA') {
    if (!data.legal_name || data.legal_name.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'La razón social es obligatoria para personas jurídicas',
        path: ['legal_name'],
      });
    }
  }
});

export type CreatePersonInput = z.infer<typeof CreatePersonSchema>;

export const UpdatePersonSchema = PersonBaseSchema.partial();
export type UpdatePersonInput = z.infer<typeof UpdatePersonSchema>;

export interface PersonItem {
  id: string;
  person_type: PersonTypeCode;
  identity_document_type: string;
  identity_document_number: string;
  first_name: string | null;
  last_name: string | null;
  second_last_name: string | null;
  legal_name: string | null;
  trade_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  birth_date: string | null;
  marital_status: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
