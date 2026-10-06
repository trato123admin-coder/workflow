import { describe, it, expect } from 'vitest';
import {
  validateReversal,
  calculateCaseExpenses,
  isSupportRequired,
  isApprovalRequired,
  CashMovement,
} from '@workflow/shared';

describe('Cash UI Logic & Helpers (Sprint 11 — S11-02, S11-03)', () => {
  it('calcula los indicadores consolidados de saldos disponibles', () => {
    const balances = [
      {
        cash_account_id: 'acc-1',
        account_name: 'Caja Chica Efectivo',
        account_type: 'CASH',
        currency: 'PEN',
        opening_balance: 500.0,
        current_balance: 750.5,
        total_income: 400.5,
        total_expense: 150.0,
        movements_count: 5,
      },
      {
        cash_account_id: 'acc-2',
        account_name: 'Cuenta Operativa BCP',
        account_type: 'BANK',
        currency: 'PEN',
        opening_balance: 2000.0,
        current_balance: 1800.0,
        total_income: 0.0,
        total_expense: 200.0,
        movements_count: 2,
      },
    ];

    const totalBalance = balances.reduce((acc, b) => acc + b.current_balance, 0);
    const cashInHand = balances
      .filter((b) => b.account_type === 'CASH')
      .reduce((acc, b) => acc + b.current_balance, 0);

    expect(totalBalance).toBe(2550.5);
    expect(cashInHand).toBe(750.5);
  });

  it('determina si un gasto requiere comprobante de sustento según umbral (S11-04)', () => {
    const threshold = 50.0;
    expect(isSupportRequired(45.0, threshold)).toBe(false);
    expect(isSupportRequired(50.0, threshold)).toBe(false);
    expect(isSupportRequired(50.01, threshold)).toBe(true);
    expect(isSupportRequired(120.0, threshold)).toBe(true);
  });

  it('determina si un egreso requiere aprobación previa administrativa (S11-04)', () => {
    const threshold = 300.0;
    expect(isApprovalRequired(250.0, threshold)).toBe(false);
    expect(isApprovalRequired(300.0, threshold)).toBe(false);
    expect(isApprovalRequired(350.0, threshold)).toBe(true);
  });

  it('calcula el costo neto acumulado por expediente para la pestaña M9', () => {
    const caseId = 'exp-123';
    const movements: CashMovement[] = [
      {
        id: 'mov-1',
        cash_account_id: 'acc-1',
        movement_type: 'EXPENSE',
        direction: 'OUT',
        amount: 80.0,
        category_code: 'GASTOS_NOTARIALES',
        description: 'Tasa notarial minuta',
        movement_date: '2026-09-20',
        case_id: caseId,
      },
      {
        id: 'mov-2',
        cash_account_id: 'acc-1',
        movement_type: 'EXPENSE',
        direction: 'OUT',
        amount: 120.0,
        category_code: 'TASAS_REGISTRALES',
        description: 'Búsqueda registral SUNARP',
        movement_date: '2026-09-21',
        case_id: caseId,
      },
      {
        id: 'mov-3',
        cash_account_id: 'acc-1',
        movement_type: 'INCOME',
        direction: 'IN',
        amount: 20.0,
        category_code: 'GASTOS_NOTARIALES',
        description: 'Devolución de arancel notarial',
        movement_date: '2026-09-22',
        case_id: caseId,
      },
      {
        id: 'mov-4',
        cash_account_id: 'acc-1',
        movement_type: 'EXPENSE',
        direction: 'OUT',
        amount: 500.0,
        category_code: 'PUBLICACIONES',
        description: 'Publicación de otro caso',
        movement_date: '2026-09-22',
        case_id: 'exp-999', // Otro caso
      },
    ];

    const result = calculateCaseExpenses(movements, caseId);
    expect(result.count).toBe(3);
    expect(result.totalExpense).toBe(200.0);
    expect(result.totalIncome).toBe(20.0);
    expect(result.netExpense).toBe(180.0);
    expect(result.byCategory['GASTOS_NOTARIALES']).toBe(60.0);
    expect(result.byCategory['TASAS_REGISTRALES']).toBe(120.0);
  });

  it('valida que no se pueda reversar un movimiento que ya fue reversado', () => {
    const original = {
      id: 'mov-1',
      amount: 100.0,
      direction: 'OUT' as const,
      movement_type: 'EXPENSE' as const,
    };
    const existing = [{ reversal_of: 'mov-1' }];

    const check = validateReversal(original, existing);
    expect(check.isValid).toBe(false);
    expect(check.error).toContain('ya ha sido reversado');
  });
});
