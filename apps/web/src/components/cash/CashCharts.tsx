'use client';

import React from 'react';
import type { CashAccountBalance, CashMovement } from '@workflow/shared';

interface CashChartsProps {
  balances: CashAccountBalance[];
  movements: CashMovement[];
}

export const CashCharts: React.FC<CashChartsProps> = ({ balances, movements }) => {
  // 1. Agrupar movimientos por categoría para gráfico de barras
  const categoryStats = React.useMemo(() => {
    const stats: Record<string, { income: number; expense: number }> = {};
    for (const m of movements) {
      const cat = m.category_code || 'OTROS';
      if (!stats[cat]) {
        stats[cat] = { income: 0, expense: 0 };
      }
      if (m.direction === 'IN') {
        stats[cat].income += m.amount;
      } else {
        stats[cat].expense += m.amount;
      }
    }
    return Object.entries(stats).map(([category, vals]) => ({
      category: category.replace(/_/g, ' '),
      income: Number(vals.income.toFixed(2)),
      expense: Number(vals.expense.toFixed(2)),
    }));
  }, [movements]);

  // 2. Distribución de saldos para gráfico de dona
  const totalBalance = balances.reduce((sum, b) => sum + Math.max(0, b.current_balance || 0), 0);
  const donutData = React.useMemo(() => {
    const colors = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
    let currentAngle = 0;

    return balances
      .filter((b) => (b.current_balance || 0) > 0)
      .map((b, idx) => {
        const val = Math.max(0, b.current_balance || 0);
        const percent = totalBalance > 0 ? (val / totalBalance) * 100 : 0;
        const strokeDasharray = `${percent * 2.387} 238.7`; // 2 * PI * 38 ≈ 238.7
        const strokeDashoffset = -currentAngle * 2.387;
        currentAngle += percent;

        return {
          name: b.account_name,
          value: val,
          percent: Number(percent.toFixed(1)),
          color: colors[idx % colors.length],
          strokeDasharray,
          strokeDashoffset,
        };
      });
  }, [balances, totalBalance]);

  const maxBarValue = Math.max(
    1,
    ...categoryStats.flatMap((c) => [c.income, c.expense])
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Gráfico de barras: Flujo por Categoría */}
      <div className="lg:col-span-2 p-5 rounded-2xl border border-border bg-card shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Flujo Operativo por Categoría
            </h3>
            <p className="text-[11px] text-muted-foreground">Comparativa de ingresos vs egresos</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="w-3 h-3 rounded-sm bg-emerald-500 shrink-0" /> Ingresos
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="w-3 h-3 rounded-sm bg-rose-500 shrink-0" /> Egresos
            </span>
          </div>
        </div>

        {categoryStats.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            No hay movimientos registrados para graficar
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            {categoryStats.map((item) => (
              <div key={item.category} className="space-y-1">
                <div className="flex justify-between text-xs font-medium text-muted-foreground">
                  <span className="truncate max-w-[200px]">{item.category}</span>
                  <span>
                    +{item.income.toLocaleString('es-PE', { minimumFractionDigits: 2 })} / -
                    {item.expense.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 h-3 bg-muted/30 rounded overflow-hidden">
                  <div className="flex justify-end">
                    <div
                      className="bg-emerald-500 rounded-l h-full transition-all duration-500"
                      style={{ width: `${(item.income / maxBarValue) * 100}%` }}
                    />
                  </div>
                  <div className="flex justify-start">
                    <div
                      className="bg-rose-500 rounded-r h-full transition-all duration-500"
                      style={{ width: `${(item.expense / maxBarValue) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Gráfico circular: Distribución por Cuenta */}
      <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-4 flex flex-col justify-between">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
            Distribución de Fondos
          </h3>
          <p className="text-[11px] text-muted-foreground">Participación según medio o caja</p>
        </div>

        <div className="flex flex-col items-center justify-center my-auto py-2">
          <div className="relative w-36 h-36">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="38"
                fill="none"
                stroke="currentColor"
                strokeWidth="12"
                className="text-muted/20"
              />
              {donutData.map((d, i) => (
                <circle
                  key={i}
                  cx="50"
                  cy="50"
                  r="38"
                  fill="none"
                  stroke={d.color}
                  strokeWidth="12"
                  strokeDasharray={d.strokeDasharray}
                  strokeDashoffset={d.strokeDashoffset}
                  className="transition-all duration-500"
                />
              ))}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-xs font-bold text-foreground">
                S/ {totalBalance.toLocaleString('es-PE', { maximumFractionDigits: 0 })}
              </span>
              <span className="text-[10px] text-muted-foreground">Total</span>
            </div>
          </div>
        </div>

        <div className="space-y-1.5 pt-2 border-t border-border">
          {donutData.map((d, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 truncate max-w-[140px]">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                <span className="text-muted-foreground truncate">{d.name}</span>
              </div>
              <span className="font-semibold text-foreground">{d.percent}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
