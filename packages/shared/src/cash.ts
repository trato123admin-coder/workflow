import { z } from 'zod';

/**
 * Tipos y esquemas del módulo de Caja Chica (Sprint 11)
 * Fuente: docs/v2.md §9, §4.3, docs/v2.1 §3.2, §3.5 y docs/02-plan-sprints.md
 */

export const CASH_MOVEMENT_TYPES = ['INCOME', 'EXPENSE', 'ADJUSTMENT', 'REVERSAL'] as const;
export type CashMovementType = (typeof CASH_MOVEMENT_TYPES)[number];

export const CASH_DIRECTIONS = ['IN', 'OUT'] as const;
export type CashDirection = (typeof CASH_DIRECTIONS)[number];

export const CASH_ACCOUNT_TYPES = ['CASH', 'BANK', 'CARD', 'OTHER'] as const;
export type CashAccountType = (typeof CASH_ACCOUNT_TYPES)[number];

export const CASH_REQUEST_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'DISBURSED', 'CANCELLED'] as const;
export type CashRequestStatus = (typeof CASH_REQUEST_STATUSES)[number];

export const CASH_PERIOD_STATUSES = ['OPEN', 'CLOSED'] as const;
export type CashPeriodStatus = (typeof CASH_PERIOD_STATUSES)[number];

export const CASH_RECONCILIATION_STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'] as const;
export type CashReconciliationStatus = (typeof CASH_RECONCILIATION_STATUSES)[number];

export const cashAccountSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  account_type: z.string().min(1, 'El tipo de cuenta es requerido'),
  currency: z.string().min(1, 'La moneda es requerida').default('PEN'),
  opening_balance: z.number().min(0, 'El saldo de apertura no puede ser negativo').default(0),
  responsible_user_id: z.string().uuid().nullable().optional(),
  is_active: z.boolean().default(true),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type CashAccount = z.infer<typeof cashAccountSchema>;

export const cashPeriodSchema = z.object({
  id: z.string().uuid().optional(),
  cash_account_id: z.string().uuid('ID de cuenta requerido'),
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha YYYY-MM-DD inválido'),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha YYYY-MM-DD inválido'),
  status: z.enum(CASH_PERIOD_STATUSES).default('OPEN'),
  closed_at: z.string().nullable().optional(),
  closed_by: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
}).refine((data) => data.period_end >= data.period_start, {
  message: 'La fecha de fin debe ser posterior o igual a la de inicio',
  path: ['period_end'],
});

export type CashPeriod = z.infer<typeof cashPeriodSchema>;

export const cashMovementSchema = z.object({
  id: z.string().uuid().optional(),
  movement_number: z.string().optional(),
  cash_account_id: z.string().uuid('ID de cuenta requerido'),
  movement_type: z.enum(CASH_MOVEMENT_TYPES, {
    errorMap: () => ({ message: 'Tipo de movimiento inválido' }),
  }),
  direction: z.enum(CASH_DIRECTIONS, {
    errorMap: () => ({ message: 'Dirección de fondos inválida (IN/OUT)' }),
  }),
  amount: z.number().positive('El monto debe ser estrictamente mayor a 0'),
  category_code: z.string().min(1, 'La categoría contable es requerida'),
  description: z.string().min(2, 'La descripción es obligatoria').max(255),
  reference: z.string().max(100).nullable().optional(),
  movement_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha YYYY-MM-DD inválido'),
  support_document_path: z.string().nullable().optional(),
  case_id: z.string().uuid().nullable().optional(),
  request_id: z.string().uuid().nullable().optional(),
  reversal_of: z.string().uuid().nullable().optional(),
  created_by: z.string().uuid().optional(),
  created_at: z.string().optional(),
});

export type CashMovement = z.infer<typeof cashMovementSchema>;

export const cashRequestSchema = z.object({
  id: z.string().uuid().optional(),
  request_number: z.string().optional(),
  case_id: z.string().uuid().nullable().optional(),
  requested_by: z.string().uuid().optional(),
  amount: z.number().positive('El monto solicitado debe ser mayor a 0'),
  currency: z.string().min(1, 'La moneda es requerida').default('PEN'),
  category_code: z.string().min(1, 'La categoría contable es requerida'),
  reason: z.string().min(3, 'El motivo debe tener al menos 3 caracteres').max(500),
  status: z.enum(CASH_REQUEST_STATUSES).default('PENDING'),
  approved_by: z.string().uuid().nullable().optional(),
  approved_at: z.string().nullable().optional(),
  rejection_reason: z.string().nullable().optional(),
  disbursed_at: z.string().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type CashRequest = z.infer<typeof cashRequestSchema>;

export const cashReconciliationSchema = z.object({
  id: z.string().uuid().optional(),
  cash_account_id: z.string().uuid('ID de cuenta requerido'),
  cash_period_id: z.string().uuid().nullable().optional(),
  reconciliation_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha YYYY-MM-DD inválido'),
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha YYYY-MM-DD inválido'),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha YYYY-MM-DD inválido'),
  system_balance: z.number(),
  counted_balance: z.number().min(0, 'El saldo contado no puede ser negativo'),
  difference: z.number().optional(),
  observations: z.string().nullable().optional(),
  status: z.enum(CASH_RECONCILIATION_STATUSES).default('DRAFT'),
  opened_by: z.string().uuid().optional(),
  opened_at: z.string().optional(),
  approved_by: z.string().uuid().nullable().optional(),
  approved_at: z.string().nullable().optional(),
  rejection_reason: z.string().nullable().optional(),
}).refine((data) => {
  const diff = Number((data.counted_balance - data.system_balance).toFixed(2));
  if (Math.abs(diff) > 0.001) {
    return Boolean(data.observations && data.observations.trim().length >= 3);
  }
  return true;
}, {
  message: 'Si existe diferencia entre el saldo del sistema y el contado, las observaciones son obligatorias',
  path: ['observations'],
});

export type CashReconciliation = z.infer<typeof cashReconciliationSchema>;

export interface CashAccountBalance {
  cash_account_id: string;
  account_name: string;
  account_type: string;
  currency: string;
  opening_balance: number;
  current_balance: number;
  total_income: number;
  total_expense: number;
  movements_count: number;
}

/**
 * Propiedad matemática: saldo = apertura + Σ(ingresos) - Σ(egresos)
 */
export function calculateBalance(
  openingBalance: number,
  movements: Array<{ direction: CashDirection; amount: number }>
): number {
  let net = Number(openingBalance) || 0;
  for (const m of movements) {
    const amt = Number(m.amount) || 0;
    if (m.direction === 'IN') {
      net += amt;
    } else if (m.direction === 'OUT') {
      net -= amt;
    }
  }
  return Number(net.toFixed(2));
}

/**
 * Validación de reglas de reverso contable
 */
export function validateReversal(
  original: { id: string; amount: number; direction: CashDirection; movement_type: CashMovementType; reversal_of?: string | null },
  existingReversals: Array<{ reversal_of?: string | null }>
): { isValid: boolean; error?: string; reverseDirection?: CashDirection } {
  if (original.movement_type === 'REVERSAL' || original.reversal_of) {
    return { isValid: false, error: 'No se puede reversar un movimiento que ya es un reverso' };
  }

  const alreadyReversed = existingReversals.some((r) => r.reversal_of === original.id);
  if (alreadyReversed) {
    return { isValid: false, error: 'Este movimiento ya ha sido reversado previamente' };
  }

  const reverseDirection: CashDirection = original.direction === 'IN' ? 'OUT' : 'IN';
  return { isValid: true, reverseDirection };
}

/**
 * M9: Costo acumulado por caso y categoría
 */
export function calculateCaseExpenses(
  movements: Array<{
    case_id?: string | null;
    amount: number;
    direction: CashDirection;
    category_code: string;
    currency?: string;
  }>,
  caseId: string
): {
  totalExpense: number;
  totalIncome: number;
  netExpense: number;
  byCategory: Record<string, number>;
  count: number;
} {
  const caseMovements = movements.filter((m) => m.case_id === caseId);
  let totalExpense = 0;
  let totalIncome = 0;
  const byCategory: Record<string, number> = {};

  for (const m of caseMovements) {
    const amt = Number(m.amount) || 0;
    if (m.direction === 'OUT') {
      totalExpense += amt;
      byCategory[m.category_code] = Number(((byCategory[m.category_code] || 0) + amt).toFixed(2));
    } else if (m.direction === 'IN') {
      totalIncome += amt;
      byCategory[m.category_code] = Number(((byCategory[m.category_code] || 0) - amt).toFixed(2));
    }
  }

  return {
    totalExpense: Number(totalExpense.toFixed(2)),
    totalIncome: Number(totalIncome.toFixed(2)),
    netExpense: Number((totalExpense - totalIncome).toFixed(2)),
    byCategory,
    count: caseMovements.length,
  };
}

/**
 * Validador de comprobante requerido según umbral
 */
export function isSupportRequired(amount: number, threshold = 50.0): boolean {
  return amount > threshold;
}

/**
 * Validador de aprobación previa requerida según umbral
 */
export function isApprovalRequired(amount: number, threshold = 300.0): boolean {
  return amount > threshold;
}
