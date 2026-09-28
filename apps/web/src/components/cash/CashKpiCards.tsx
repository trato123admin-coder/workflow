'use client';

import React from 'react';
import { KpiCard } from '../ui/KpiCard';
import { Coins, Wallet, ArrowDownRight, ArrowUpRight, Clock, ShieldCheck, ShieldAlert } from 'lucide-react';
import type { CashAccountBalance } from '@workflow/shared';

interface CashKpiCardsProps {
  balances: CashAccountBalance[];
  pendingRequestsCount: number;
  isMfaActive?: boolean;
}

export const CashKpiCards: React.FC<CashKpiCardsProps> = ({
  balances,
  pendingRequestsCount,
  isMfaActive = true,
}) => {
  const totalBalance = balances.reduce((acc, b) => acc + (b.current_balance || 0), 0);
  const totalIncome = balances.reduce((acc, b) => acc + (b.total_income || 0), 0);
  const totalExpense = balances.reduce((acc, b) => acc + (b.total_expense || 0), 0);

  const cashInHand = balances
    .filter((b) => b.account_type === 'CASH')
    .reduce((acc, b) => acc + (b.current_balance || 0), 0);

  const bankBalance = balances
    .filter((b) => b.account_type === 'BANK')
    .reduce((acc, b) => acc + (b.current_balance || 0), 0);

  const formatCurrency = (val: number, cur = 'PEN') => {
    return `${cur === 'USD' ? '$' : 'S/'} ${val.toLocaleString('es-PE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      <KpiCard
        title="Saldo Total Disponible"
        value={formatCurrency(totalBalance)}
        icon={<Coins className="w-5 h-5" />}
        description="Consolidado de todas las cajas"
      />

      <KpiCard
        title="Efectivo en Caja"
        value={formatCurrency(cashInHand)}
        icon={<Wallet className="w-5 h-5" />}
        description={`Banco: ${formatCurrency(bankBalance)}`}
      />

      <KpiCard
        title="Ingresos Registrados"
        value={formatCurrency(totalIncome)}
        icon={<ArrowDownRight className="w-5 h-5 text-emerald-600" />}
        change={{ value: 'Acumulado', trend: 'up' }}
      />

      <KpiCard
        title="Egresos y Gastos"
        value={formatCurrency(totalExpense)}
        icon={<ArrowUpRight className="w-5 h-5 text-rose-600" />}
        change={{ value: 'Acumulado', trend: 'down' }}
      />

      <div className="bg-card text-card-foreground rounded-xl border border-border p-5 shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">Solicitudes & MFA</span>
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Pendientes:</span>
            <span className="text-lg font-bold text-foreground">{pendingRequestsCount}</span>
          </div>

          <div className="flex items-center gap-1.5 pt-1 border-t border-border text-xs">
            {isMfaActive ? (
              <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                <ShieldCheck className="w-3.5 h-3.5" /> MFA aal2 Activo
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400 font-medium">
                <ShieldAlert className="w-3.5 h-3.5" /> Requiere MFA
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
