import { describe, it, expect } from 'vitest';
import {
  calculateBalance,
  validateReversal,
  calculateCaseExpenses,
  isSupportRequired,
  isApprovalRequired,
  cashMovementSchema,
  cashRequestSchema,
  cashReconciliationSchema,
  cashAccountSchema,
  cashPeriodSchema,
  CashDirection,
  CashMovementType,
} from '../cash.js';

describe('Módulo de Caja Chica — shared/cash', () => {
  describe('calculateBalance — Propiedad matemática de saldo contable', () => {
    it('calcula saldo = apertura + Σ(ingresos) - Σ(egresos) con decimales exactos', () => {
      const opening = 1000.5;
      const movements = [
        { direction: 'IN' as CashDirection, amount: 250.25 },
        { direction: 'OUT' as CashDirection, amount: 120.75 },
        { direction: 'OUT' as CashDirection, amount: 80.0 },
        { direction: 'IN' as CashDirection, amount: 50.0 },
      ];

      // 1000.50 + 250.25 - 120.75 - 80.00 + 50.00 = 1100.00
      const balance = calculateBalance(opening, movements);
      expect(balance).toBe(1100.0);
    });

    it('prueba de propiedad: saldo invariante ante 100 movimientos y reversos aleatorios', () => {
      let expectedBalance = 500.0;
      const openingBalance = 500.0;
      const movements: Array<{ direction: CashDirection; amount: number }> = [];

      for (let i = 0; i < 50; i++) {
        const isIncome = i % 2 === 0;
        const amount = Number((Math.random() * 100 + 1).toFixed(2));
        const dir: CashDirection = isIncome ? 'IN' : 'OUT';
        movements.push({ direction: dir, amount });
        expectedBalance = isIncome ? expectedBalance + amount : expectedBalance - amount;

        // Cada 5 operaciones, simular un movimiento y su reverso inmediato
        if (i % 5 === 0) {
          const revAmount = 45.5;
          // movimiento original
          movements.push({ direction: 'OUT', amount: revAmount });
          expectedBalance -= revAmount;
          // reverso
          movements.push({ direction: 'IN', amount: revAmount });
          expectedBalance += revAmount;
        }
      }

      const calculated = calculateBalance(openingBalance, movements);
      expect(calculated).toBeCloseTo(expectedBalance, 2);
    });
  });

  describe('validateReversal — Reglas de negocio de reversos', () => {
    it('permite reversar un movimiento ordinario no reversado previamente', () => {
      const original = {
        id: 'mov-1',
        amount: 150.0,
        direction: 'OUT' as CashDirection,
        movement_type: 'EXPENSE' as CashMovementType,
      };
      const existingReversals: Array<{ reversal_of?: string | null }> = [];

      const result = validateReversal(original, existingReversals);
      expect(result.isValid).toBe(true);
      expect(result.reverseDirection).toBe('IN');
    });

    it('rechaza reversar un movimiento que ya es un REVERSAL', () => {
      const original = {
        id: 'mov-2',
        amount: 150.0,
        direction: 'IN' as CashDirection,
        movement_type: 'REVERSAL' as CashMovementType,
        reversal_of: 'mov-1',
      };
      const existingReversals: Array<{ reversal_of?: string | null }> = [];

      const result = validateReversal(original, existingReversals);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('ya es un reverso');
    });

    it('rechaza reversar un movimiento que ya fue reversado con anterioridad', () => {
      const original = {
        id: 'mov-1',
        amount: 150.0,
        direction: 'OUT' as CashDirection,
        movement_type: 'EXPENSE' as CashMovementType,
      };
      const existingReversals = [{ reversal_of: 'mov-1' }];

      const result = validateReversal(original, existingReversals);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('ya ha sido reversado');
    });
  });

  describe('calculateCaseExpenses — Costo acumulado por expediente (M9)', () => {
    it('filtra y consolida los gastos e ingresos imputados a un caso', () => {
      const caseId = 'c1111111-1111-1111-1111-111111111111';
      const otherCaseId = 'c2222222-2222-2222-2222-222222222222';

      const movements = [
        {
          case_id: caseId,
          amount: 120.0,
          direction: 'OUT' as CashDirection,
          category_code: 'GASTOS_NOTARIALES',
        },
        {
          case_id: caseId,
          amount: 85.5,
          direction: 'OUT' as CashDirection,
          category_code: 'TASAS_REGISTRALES',
        },
        {
          case_id: otherCaseId,
          amount: 300.0,
          direction: 'OUT' as CashDirection,
          category_code: 'PUBLICACIONES',
        },
        {
          case_id: caseId,
          amount: 20.0,
          direction: 'IN' as CashDirection, // devolución de tasa
          category_code: 'TASAS_REGISTRALES',
        },
      ];

      const res = calculateCaseExpenses(movements, caseId);
      expect(res.count).toBe(3);
      expect(res.totalExpense).toBe(205.5);
      expect(res.totalIncome).toBe(20.0);
      expect(res.netExpense).toBe(185.5);
      expect(res.byCategory['GASTOS_NOTARIALES']).toBe(120.0);
      expect(res.byCategory['TASAS_REGISTRALES']).toBe(65.5);
    });
  });

  describe('Esquemas Zod de frontera', () => {
    it('valida cashAccountSchema correctamente', () => {
      const valid = cashAccountSchema.safeParse({
        name: 'Caja Operativa Notarial',
        account_type: 'CASH',
        currency: 'PEN',
        opening_balance: 500,
      });
      expect(valid.success).toBe(true);

      const invalid = cashAccountSchema.safeParse({
        name: 'C',
        account_type: 'CASH',
        opening_balance: -50,
      });
      expect(invalid.success).toBe(false);
    });

    it('valida cashMovementSchema con monto positivo', () => {
      const valid = cashMovementSchema.safeParse({
        cash_account_id: 'a0000000-0000-0000-0000-000000000001',
        movement_type: 'EXPENSE',
        direction: 'OUT',
        amount: 45.2,
        category_code: 'GASTOS_NOTARIALES',
        description: 'Copia literal notarial',
        movement_date: '2026-09-28',
      });
      expect(valid.success).toBe(true);

      const invalidZero = cashMovementSchema.safeParse({
        cash_account_id: 'a0000000-0000-0000-0000-000000000001',
        movement_type: 'EXPENSE',
        direction: 'OUT',
        amount: 0,
        category_code: 'GASTOS_NOTARIALES',
        description: 'Prueba',
        movement_date: '2026-09-28',
      });
      expect(invalidZero.success).toBe(false);
    });

    it('valida cashRequestSchema correctamente', () => {
      const valid = cashRequestSchema.safeParse({
        amount: 250.0,
        currency: 'PEN',
        category_code: 'TASAS_REGISTRALES',
        reason: 'Pago de aranceles registrales SUNARP',
      });
      expect(valid.success).toBe(true);

      const invalid = cashRequestSchema.safeParse({
        amount: -10,
        currency: 'PEN',
        category_code: 'TASAS_REGISTRALES',
        reason: 'No',
      });
      expect(invalid.success).toBe(false);
    });

    it('valida cashPeriodSchema con rango de fechas coherente', () => {
      const valid = cashPeriodSchema.safeParse({
        cash_account_id: 'a0000000-0000-0000-0000-000000000001',
        period_start: '2026-09-01',
        period_end: '2026-09-30',
        status: 'OPEN',
      });
      expect(valid.success).toBe(true);

      const invalidRange = cashPeriodSchema.safeParse({
        cash_account_id: 'a0000000-0000-0000-0000-000000000001',
        period_start: '2026-09-30',
        period_end: '2026-09-01',
        status: 'OPEN',
      });
      expect(invalidRange.success).toBe(false);
    });

    it('exige observaciones en cashReconciliationSchema cuando existe diferencia', () => {
      // Sin diferencia: observaciones opcionales
      const balanced = cashReconciliationSchema.safeParse({
        cash_account_id: 'a0000000-0000-0000-0000-000000000001',
        reconciliation_date: '2026-09-28',
        period_start: '2026-09-01',
        period_end: '2026-09-28',
        system_balance: 500.0,
        counted_balance: 500.0,
      });
      expect(balanced.success).toBe(true);

      // Con diferencia y sin observaciones: DEBE FALLAR
      const discrepantNoObs = cashReconciliationSchema.safeParse({
        cash_account_id: 'a0000000-0000-0000-0000-000000000001',
        reconciliation_date: '2026-09-28',
        period_start: '2026-09-01',
        period_end: '2026-09-28',
        system_balance: 500.0,
        counted_balance: 480.0, // Faltante de 20
        observations: '',
      });
      expect(discrepantNoObs.success).toBe(false);

      // Con diferencia y con observaciones: DEBE PASAR
      const discrepantWithObs = cashReconciliationSchema.safeParse({
        cash_account_id: 'a0000000-0000-0000-0000-000000000001',
        reconciliation_date: '2026-09-28',
        period_start: '2026-09-01',
        period_end: '2026-09-28',
        system_balance: 500.0,
        counted_balance: 480.0,
        observations: 'Comprobante de movilidad pendiente de entrega por gestor',
      });
      expect(discrepantWithObs.success).toBe(true);
    });

    it('valida umbrales de comprobante y aprobación previa', () => {
      expect(isSupportRequired(49.99, 50.0)).toBe(false);
      expect(isSupportRequired(50.01, 50.0)).toBe(true);

      expect(isApprovalRequired(300.0, 300.0)).toBe(false);
      expect(isApprovalRequired(300.01, 300.0)).toBe(true);
    });
  });
});
