import { z } from 'zod';
import { PERMISSION_CODES } from './permissions.js';

export const LoginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'El correo electrónico es requerido')
    .email('Ingrese un correo electrónico válido'),
  password: z
    .string()
    .min(1, 'La contraseña es requerida')
    .min(8, 'La contraseña debe tener al menos 8 caracteres'),
});

export type LoginInput = z.infer<typeof LoginSchema>;

export const ForgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'El correo electrónico es requerido')
    .email('Ingrese un correo electrónico válido'),
});

export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;

export const ResetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'La contraseña debe tener al menos 8 caracteres')
      .regex(/[A-Z]/, 'Debe contener al menos una letra mayúscula')
      .regex(/[0-9]/, 'Debe contener al menos un número'),
    confirmPassword: z.string().min(1, 'Confirme su contraseña'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });

export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

export const MfaVerifySchema = z.object({
  code: z
    .string()
    .trim()
    .length(6, 'El código debe tener exactamente 6 dígitos')
    .regex(/^\d{6}$/, 'El código debe contener solo números'),
});

export type MfaVerifyInput = z.infer<typeof MfaVerifySchema>;

export const CreateUserSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'El correo electrónico es requerido')
    .email('Ingrese un correo electrónico válido'),
  firstName: z
    .string()
    .trim()
    .min(1, 'El nombre es requerido')
    .max(100, 'El nombre no puede exceder 100 caracteres'),
  lastName: z
    .string()
    .trim()
    .min(1, 'El apellido es requerido')
    .max(100, 'El apellido no puede exceder 100 caracteres'),
  roleIds: z
    .array(z.string().uuid('Identificador de rol inválido'))
    .min(1, 'Debe asignar al menos un rol al usuario'),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;

export const UpdateUserSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, 'El nombre es requerido')
    .max(100, 'El nombre no puede exceder 100 caracteres'),
  lastName: z
    .string()
    .trim()
    .min(1, 'El apellido es requerido')
    .max(100, 'El apellido no puede exceder 100 caracteres'),
  isActive: z.boolean(),
  roleIds: z
    .array(z.string().uuid('Identificador de rol inválido'))
    .min(1, 'Debe asignar al menos un rol al usuario'),
});

export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;

export const CreateRoleSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, 'El código debe tener al menos 2 caracteres')
    .max(30, 'El código no puede exceder 30 caracteres')
    .regex(
      /^[A-Z0-9_]+$/,
      'El código solo puede contener letras mayúsculas, números y guiones bajos',
    ),
  name: z
    .string()
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(80, 'El nombre no puede exceder 80 caracteres'),
  description: z.string().trim().max(255).optional(),
  requiresMfa: z.boolean().default(false),
  permissionCodes: z.array(z.enum(PERMISSION_CODES as unknown as [string, ...string[]])),
});

export type CreateRoleInput = z.infer<typeof CreateRoleSchema>;

export const UpdateRoleSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(80, 'El nombre no puede exceder 80 caracteres'),
  description: z.string().trim().max(255).optional(),
  requiresMfa: z.boolean().default(false),
  permissionCodes: z.array(z.enum(PERMISSION_CODES as unknown as [string, ...string[]])),
});

export type UpdateRoleInput = z.infer<typeof UpdateRoleSchema>;
